import { expect } from 'chai';
import request from 'request';
import dbClient from '../../utils/db';

describe('App Controller', () => {
  const URL = 'http://localhost:5000';

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

  it('GET /status', (done) => {
    request.get(`${URL}/status`, (err, res, body) => {
      expect(err).to.be.null;
      expect(res.statusCode).to.equal(200);
      expect(JSON.parse(body)).to.deep.equal({ redis: true, db: true });
      done();
    });
  });

  it('GET /stats', (done) => {
    request.get(`${URL}/stats`, (err, res, body) => {
      expect(err).to.be.null;
      expect(res.statusCode).to.equal(200);
      expect(JSON.parse(body)).to.deep.equal({ users: 0, files: 0 });
      done();
    });
  });
});
