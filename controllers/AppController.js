import redisClient from '../utils/redis';
import dbClient from '../utils/db';

class AppController {
  static getStatus(_request, response) {
    response
      .status(200)
      .json({ redis: redisClient.isAlive(), db: dbClient.isAlive() });
  }

  static getStats(_request, response) {
    const stats = {
      users: dbClient.nbUsers(),
      files: dbClient.nbFiles(),
    };
    return response.status(200).send(stats);
  }
}

module.exports = AppController;
