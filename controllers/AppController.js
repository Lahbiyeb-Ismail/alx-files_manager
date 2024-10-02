import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AppController {
  static getStatus(req, res) {
    const redisOnline = redisClient.isAlive();
    const dbOnline = dbClient.isAlive();
    res.status(200).json({ redis: redisOnline, db: dbOnline });
  }

  static async getStats(req, res) {
    const usersnb = await dbClient.nbUsers();
    const filesnb = await dbClient.nbFiles();
    res.status(200).json({ users: usersnb, files: filesnb });
  }
}

module.exports = AppController;
