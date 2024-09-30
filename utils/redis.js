import { createClient } from 'redis';
import { promisify } from 'util';

class RedisClient {
  constructor() {
    this.client = createClient();
    this.client.on('error', (err) => {
      this.connectionEstablished = false;
      console.log('Redis client failed to connect:', err.toString());
    });
    this.connectionEstablished = true;
    this.client.on('connect', () => {
      this.connectionEstablished = true;
    });
  }

  isAlive() {
    return this.connectionEstablished;
  }

  async get(key) {
    return promisify(this.client.GET).bind(this.client)(key);
  }

  async set(key, value, duration) {
    return promisify(this.client.SET).bind(this.client)(
      key,
      value,
      'EX',
      duration,
    );
  }

  async del(key) {
    return promisify(this.client.DEL).bind(this.client)(key);
  }
}

const redisClient = new RedisClient();
export default redisClient;
