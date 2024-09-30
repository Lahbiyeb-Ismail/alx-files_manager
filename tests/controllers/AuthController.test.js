import { expect } from 'chai';
import request from 'request';
import dbClient from '../../utils/db';

describe('Auth Controller', () => {
  const URL = 'http://localhost:5000';
  let token = '';
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
          .then(() => {
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
          })
          .catch((deleteErr) => done(deleteErr));
      })
      .catch((connectErr) => done(connectErr));
  });

  it('GET /connect', (done) => {
    request.get(
      `${URL}/connect`,
      {
        headers: {
          Authorization: 'Basic aGVsbG9Ad29ybGQuY29tOkh1aFllYWgxMDE=',
        },
      },
      (err, res, body) => {
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(JSON.parse(body).token).to.exist;
        expect(JSON.parse(body).token.length).to.be.greaterThan(0);
        token = JSON.parse(body).token;
        done();
      }
    );
  });

  it('GET /users/me', (done) => {
    request.get(
      `${URL}/users/me`,
      { headers: { 'x-token': token } },
      (err, res, body) => {
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(200);
        expect(JSON.parse(body).email).to.equal(mockUser.email);
        expect(JSON.parse(body).id.length).to.be.greaterThan(0);
        done();
      }
    );
  });

  it('GET /disconnect', (done) => {
    request.get(
      `${URL}/disconnect`,
      { headers: { 'x-token': token } },
      (err, res, body) => {
        expect(err).to.be.null;
        expect(res.statusCode).to.equal(204);
        done();
      }
    );
  });
});
