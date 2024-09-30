import { expect } from 'chai';
import request from 'request';
import dbClient from '../../utils/db';

describe('Users Controller', () => {
  const URL = 'http://localhost:5000';
  const mockUser = {
    email: 'hello@world.com',
    password: 'HuhYeah101',
  };

  before(function (done) {
    this.timeout(10000);
    Promise.all([dbClient.client.db().collection('users')])
      .then(([usersCollection]) => {
        usersCollection
          .deleteMany({ email: mockUser.email })
          .then(() => done())
          .catch((deleteErr) => done(deleteErr));
      })
      .catch((connectErr) => done(connectErr));
    setTimeout(done, 5000);
  });

  it('POST /users', (done) => {
    request.post(
      `${URL}/users`,
      { json: { email: mockUser.email, password: mockUser.password } },
      (err, res, body) => {
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(201);
        expect(body.email).to.equal(mockUser.email);
        expect(body.id.length).to.be.greaterThan(0);
        done();
      }
    );
  });

  it('POST /users with a user that already exists', (done) => {
    request.post(
      `${URL}/users`,
      { json: { email: mockUser.email, password: mockUser.password } },
      (err, res, body) => {
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(400);
        expect(body).to.deep.equal({ error: 'Already exist' });
        done();
      }
    );
  });
});
