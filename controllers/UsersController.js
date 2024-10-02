import sha1 from 'sha1';
import { ObjectId } from 'mongodb';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';
import { userQueue } from '../worker';

class UserController {
  static async postNew(req, res) {
    const { email, password } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }
    const userCheck = await dbClient.dbClient.collection('users').findOne({ email });
    if (userCheck) {
      return res.status(400).json({ error: 'Already exist' });
    }
    const hashed = sha1(password);
    const reply = await dbClient.dbClient.collection('users').insertOne({ email, password: hashed });
    const userIdres = reply.insertedId;
    userQueue.add({ userId: userIdres });
    return res.status(201).json({ id: userIdres, email });
  }

  static async getMe(req, res) {
    try {
      const token = req.header('X-Token');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      const key = `auth_${token}`;
      const userId = await redisClient.get(key);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const user = await dbClient.dbClient
        .collection('users')
        .findOne({ _id: ObjectId(userId) });
      if (!user) return res.status(401).json({ error: 'Unauthorized-user' });
      return res.status(200).json({ id: user._id, email: user.email });
    } catch (err) {
      console.error('error in getme', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UserController;
