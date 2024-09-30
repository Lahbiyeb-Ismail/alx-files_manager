import { expect } from 'chai';
import redisClient from '../../utils/redis';

describe('RedisClient Class', () => {
  before(function (done) {
    this.timeout(10000);
    setTimeout(done, 4000);
  });

  it('RedisClient connectivity', () => {
    expect(redisClient.isAlive()).to.be.true;
  });

  it('RedisClient setting and getting', async () => {
    await redisClient.set('test_key', 'test_value', 10);
    expect(await redisClient.get('test_key')).to.equal('test_value');
  });

  it('RedisClient getting an expired value', () => {
    setTimeout(async () => {
      expect(await redisClient.get('test_key')).to.not.equal('test_value');
      expect(await redisClient.get('test_key')).to.be.null;
    }, 10000);
  });

  it('RedisClient deleting a value', async () => {
    await redisClient.set('test_key', 'test_value', 60);
    await redisClient.del('test_key');
    expect(await redisClient.get('test_key')).to.not.equal('test_value');
    expect(await redisClient.get('test_key')).to.be.null;
  });
});
