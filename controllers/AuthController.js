import { v4 as uuid4 } from 'uuid';
import sha1 from 'sha1';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class AuthController {
  static async getConnect(req, res) {
    const creds = req.header('Authorization').split(' ')[1];
    const [email, password] = Buffer.from(creds, 'base64').toString('ascii').split(':');
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const hashed = sha1(password);
    const token = uuid4();
    const user = await dbClient.dbClient.collection('users').findOne({ email, password: hashed });
    if (!user || user.password !== hashed) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await redisClient.set(`auth_${token}`, user._id.toString(), 3600 * 24);
    return res.status(200).json({ token });
  }

  static async getDisconnect(req, res) {
    const token = req.header('X-Token');
    const user = await redisClient.get(`auth_${token}`);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}

module.exports = AuthController;
