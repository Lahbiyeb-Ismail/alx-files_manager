import { expect } from 'chai';
import redisClient from '../utils/redis';

describe('redisClient', () => {
    before(async () => {
        await redisClient.client.flushall('ASYNC');
    });

    after(async () => {
       await redisClient.client.flushall('ASYNC');
    });

    it('testing connection to Redis', () => {
        expect(redisClient.isAlive()).to.be.true;
    });

    it('testing setting and getting from Redis', async () => {

        await redisClient.set('testKey', 'testValue', 10);
        const value = await redisClient.get('testKey');
        expect(value).to.equal('testValue');
    });

    it('testing redis delete', async () => {
        const key = 'ToDelete';
        await redisClient.set(key, 'value', 10);
        await redisClient.del(key);
        const result = await redisClient.get(key);
        expect(result).to.equal(null);
    });


});
