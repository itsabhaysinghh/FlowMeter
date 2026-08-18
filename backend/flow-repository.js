import {
  BatchWriteCommand,
  DeleteCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { bucketEnd, bucketStart } from './time.js';

const ROLLUP_GRANULARITIES = ['hour', 'day', 'month'];

function isConditionalFailure(error) {
  return error?.name === 'ConditionalCheckFailedException';
}

function encodeKey(key) {
  return Buffer.from(JSON.stringify(key)).toString('base64url');
}

function decodeKey(token) {
  if (!token) return undefined;
  try {
    return JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid pagination token.');
  }
}

export class DynamoFlowRepository {
  constructor({ awsRegion, readingsTableName, rollupsTableName }) {
    this.readingsTableName = readingsTableName;
    this.rollupsTableName = rollupsTableName;
    this.client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: awsRegion }), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }

  async putReading(reading) {
    const item = {
      ...reading,
      // The DynamoDB sort key. Keeping both names preserves the ingress payload.
      timestamp: reading.device_timestamp,
    };
    try {
      await this.client.send(new PutCommand({
        TableName: this.readingsTableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(#deviceId) AND attribute_not_exists(#timestamp)',
        ExpressionAttributeNames: { '#deviceId': 'device_id', '#timestamp': 'timestamp' },
      }));
    } catch (error) {
      if (isConditionalFailure(error)) return { inserted: false };
      throw error;
    }

    if (this.rollupsTableName) {
      await Promise.all(ROLLUP_GRANULARITIES.map((granularity) => this.updateRollup(reading, granularity)));
    }
    return { inserted: true };
  }

  async updateRollup(reading, granularity) {
    const start = bucketStart(reading.device_timestamp, granularity);
    await this.client.send(new UpdateCommand({
      TableName: this.rollupsTableName,
      Key: { device_bucket: `${reading.device_id}#${granularity}`, bucket_start: start },
      UpdateExpression: 'ADD #volume :volume, #flowSum :flowRate, #sampleCount :one SET #updatedAt = :receivedAt',
      ExpressionAttributeNames: {
        '#volume': 'volume_litres',
        '#flowSum': 'flow_sum_lpm',
        '#sampleCount': 'sample_count',
        '#updatedAt': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':volume': reading.flow_rate_lpm,
        ':flowRate': reading.flow_rate_lpm,
        ':one': 1,
        ':receivedAt': reading.received_at,
      },
    }));
  }

  async getLatest(deviceId) {
    const response = await this.client.send(new QueryCommand({
      TableName: this.readingsTableName,
      KeyConditionExpression: '#deviceId = :deviceId',
      ExpressionAttributeNames: { '#deviceId': 'device_id' },
      ExpressionAttributeValues: { ':deviceId': deviceId },
      ScanIndexForward: false,
      Limit: 1,
    }));
    return response.Items?.[0] || null;
  }

  async getReadingsPage({ deviceId, startTime, endTime, limit, nextToken }) {
    const response = await this.client.send(new QueryCommand({
      TableName: this.readingsTableName,
      KeyConditionExpression: '#deviceId = :deviceId AND #timestamp BETWEEN :startTime AND :endTime',
      ExpressionAttributeNames: { '#deviceId': 'device_id', '#timestamp': 'timestamp' },
      ExpressionAttributeValues: { ':deviceId': deviceId, ':startTime': startTime, ':endTime': endTime },
      ExclusiveStartKey: decodeKey(nextToken),
      Limit: limit,
      ScanIndexForward: true,
    }));
    return { records: response.Items || [], nextToken: response.LastEvaluatedKey ? encodeKey(response.LastEvaluatedKey) : undefined };
  }

  async forEachReading({ deviceId, startTime, endTime }, onPage) {
    let nextToken;
    do {
      const page = await this.getReadingsPage({ deviceId, startTime, endTime, limit: 1000, nextToken });
      await onPage(page.records);
      nextToken = page.nextToken;
    } while (nextToken);
  }

  async getRollups({ deviceId, granularity, startTime, endTime }) {
    if (!this.rollupsTableName) return null;
    const records = [];
    let exclusiveStartKey;
    do {
      const response = await this.client.send(new QueryCommand({
        TableName: this.rollupsTableName,
        KeyConditionExpression: '#deviceBucket = :deviceBucket AND #bucketStart BETWEEN :startTime AND :endTime',
        ExpressionAttributeNames: { '#deviceBucket': 'device_bucket', '#bucketStart': 'bucket_start' },
        ExpressionAttributeValues: {
          ':deviceBucket': `${deviceId}#${granularity}`,
          ':startTime': bucketStart(startTime, granularity),
          ':endTime': bucketStart(endTime, granularity),
        },
        ExclusiveStartKey: exclusiveStartKey,
      }));
      records.push(...(response.Items || []));
      exclusiveStartKey = response.LastEvaluatedKey;
    } while (exclusiveStartKey);
    return records;
  }

  async deleteRange({ deviceId, startTime, endTime }) {
    const deleted = [];
    await this.forEachReading({ deviceId, startTime, endTime }, async (records) => {
      deleted.push(...records);
      for (let index = 0; index < records.length; index += 25) {
        await this.deleteBatch(records.slice(index, index + 25));
      }
    });

    if (this.rollupsTableName && deleted.length) {
      await this.rebuildAffectedRollups(deviceId, deleted);
    }
    return deleted.length;
  }

  async deleteBatch(records) {
    let pending = records.map((record) => ({ DeleteRequest: { Key: { device_id: record.device_id, timestamp: record.timestamp } } }));
    for (let attempt = 0; pending.length && attempt < 6; attempt += 1) {
      const response = await this.client.send(new BatchWriteCommand({
        RequestItems: { [this.readingsTableName]: pending },
      }));
      pending = response.UnprocessedItems?.[this.readingsTableName] || [];
      if (pending.length) await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 100));
    }
    if (pending.length) throw new Error('DynamoDB did not process all deletion requests.');
  }

  async rebuildAffectedRollups(deviceId, deletedRecords) {
    const buckets = new Set();
    for (const record of deletedRecords) {
      for (const granularity of ROLLUP_GRANULARITIES) {
        buckets.add(`${granularity}:${bucketStart(record.timestamp, granularity)}`);
      }
    }
    for (const bucket of buckets) {
      const [granularity, timestampString] = bucket.split(':');
      const startTime = Number(timestampString);
      const endTime = bucketEnd(startTime, granularity);
      const stats = { volume: 0, flowSum: 0, samples: 0, updatedAt: 0 };
      await this.forEachReading({ deviceId, startTime, endTime }, async (records) => {
        for (const record of records) {
          stats.volume += Number(record.flow_rate_lpm) || 0;
          stats.flowSum += Number(record.flow_rate_lpm) || 0;
          stats.samples += 1;
          stats.updatedAt = Math.max(stats.updatedAt, Number(record.received_at) || 0);
        }
      });
      const key = { device_bucket: `${deviceId}#${granularity}`, bucket_start: startTime };
      if (!stats.samples) {
        await this.client.send(new DeleteCommand({ TableName: this.rollupsTableName, Key: key }));
      } else {
        await this.client.send(new PutCommand({
          TableName: this.rollupsTableName,
          Item: { ...key, volume_litres: stats.volume, flow_sum_lpm: stats.flowSum, sample_count: stats.samples, updated_at: stats.updatedAt },
        }));
      }
    }
  }
}
