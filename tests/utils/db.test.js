import { expect } from 'chai';
import dbClient from '../../utils/db';

describe('DBClient Class', () => {
  before(function (done) {
    this.timeout(10000);
    Promise.all([
      dbClient.client.db().collection('users'),
      dbClient.client.db().collection('files'),
    ])
      .then(([usersCollection, filesCollection]) => {
        Promise.all([
          usersCollection.deleteMany({}),
          filesCollection.deleteMany({}),
        ])
          .then(() => done())
          .catch((deleteErr) => done(deleteErr));
      })
      .catch((connectErr) => done(connectErr));
  });

  it('DBClient connectivity', () => {
    expect(dbClient.isAlive()).to.be.true;
  });

  it('nbUsers returns the correct user count', async () => {
    expect(await dbClient.nbUsers()).to.equal(0);
  });

  it('nbFiles returns the correct file count', async () => {
    expect(await dbClient.nbFiles()).to.equal(0);
  });
});
