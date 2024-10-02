import { v4 as uuidv4 } from 'uuid';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

class FilesController {
  static async postUpload(req, res) {
    const fileQueue = new Queue('fileQueue');
    const dir = process.env.FOLDER_PATH || '/tmp/files_manager';

    async function getIdKey(req) {
      const userInfo = { userId: null, key: null };

      const token = req.header('X-Token');
      if (!token) return userInfo;

      userInfo.key = `auth_${token}`;
      userInfo.userId = await redisClient.get(userInfo.key);

      return userInfo;
    }

    const { userId } = await getIdKey(req);

    function isValidUser(id) {
      try {
        ObjectId(id);
      } catch (error) {
        return false;
      }
      return true;
    }

    if (!isValidUser(userId)) return res.status(401).json({ error: 'Unauthorized' });

    const user = await dbClient.dbClient.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const fileName = req.body.name;
    if (!fileName) return res.status(400).json({ error: 'Missing name' });

    const fileType = req.body.type;
    if (!fileType || !['folder', 'file', 'image'].includes(fileType)) return res.status(400).json({ error: 'Missing type' });

    const fileData = req.body.data;
    if (!fileData && fileType !== 'folder') return res.status(400).json({ error: 'Missing data' });

    const publicFile = req.body.isPublic || false;
    let parentId = req.body.parentId || 0;
    parentId = parentId === '0' ? 0 : parentId;
    if (parentId !== 0) {
      const parentFile = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(parentId) });
      if (!parentFile) return res.status(400).json({ error: 'Parent not found' });
      if (parentFile.type !== 'folder') return res.status(400).json({ error: 'Parent is not a folder' });
    }

    const fileInsertData = {
      userId: user._id,
      name: fileName,
      type: fileType,
      isPublic: publicFile,
      parentId,
    };

    if (fileType === 'folder') {
      await dbClient.dbClient.collection('files').insertOne(fileInsertData);
      return res.status(201).json({
        id: fileInsertData._id,
        userId: fileInsertData.userId,
        name: fileInsertData.name,
        type: fileInsertData.type,
        isPublic: fileInsertData.isPublic,
        parentId: fileInsertData.parentId,
      });
    }

    const fileUid = uuidv4();

    const decData = Buffer.from(fileData, 'base64');
    const filePath = `${dir}/${fileUid}`;

    fs.mkdir(dir, { recursive: true }, (error) => {
      if (error) return res.status(400).json({ error: error.message });
      return true;
    });

    fs.writeFile(filePath, decData, (error) => {
      if (error) return res.status(400).json({ error: error.message });
      return true;
    });

    fileInsertData.localPath = filePath;
    await dbClient.dbClient.collection('files').insertOne(fileInsertData);

    fileQueue.add({
      userId: fileInsertData.userId,
      fileId: fileInsertData._id,
    });

    return res.status(201).json({
      id: fileInsertData._id,
      userId: fileInsertData.userId,
      name: fileInsertData.name,
      type: fileInsertData.type,
      isPublic: fileInsertData.isPublic,
      parentId: fileInsertData.parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const fileId = req.params.id;
    const file = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    if (!file) return res.status(404).json({ error: 'Not found' });

    return res.json(file);
  }

  static async getIndex(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const userIdString = await redisClient.get(`auth_${token}`);

    if (!userIdString) return res.status(401).json({ error: 'Unauthorized' });

    const parentId = req.query.parentId ? ObjectId(req.query.parentId) : '0';
    const userId = ObjectId(userIdString);
    const filesCount = await dbClient.dbClient.collection('files')
      .countDocuments({ userId, parentId });

    if (filesCount === '0') return res.json([]);

    const skip = (parseInt(req.query.page, 10) || 0) * 20;
    const files = await dbClient.dbClient.collection('files')
      .aggregate([
        { $match: { userId, parentId } },
        { $skip: skip },
        { $limit: 20 },
      ]).toArray();

    const newResult = files.map((file) => ({
      ...file,
      id: file._id,
      _id: undefined,
    }));

    return res.json(newResult);
  }

  static async putPublish(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const fileId = req.params.id;
    const file = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });
    await dbClient.dbClient.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: true } });
    const updated = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId) });
    return res.status(200).json(updated);
  }

  static async putUnpublish(req, res) {
    const token = req.header('X-Token');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const fileId = req.params.id;
    const file = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) return res.status(404).json({ error: 'Not found' });
    await dbClient.dbClient.collection('files').updateOne({ _id: ObjectId(fileId) }, { $set: { isPublic: false } });
    const updated = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId) });
    return res.status(200).json(updated);
  }

  static async getFile(req, res) {
    const token = req.header('X-Token');
    const { size } = req.query;
    const userId = await redisClient.get(`auth_${token}`);
    const fileId = req.params.id;
    const file = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId) });
    if (!file || (!file.isPublic && (!userId || userId !== file.userId.toString()))) return res.status(404).json({ error: 'Not found' });
    if (file.type === 'folder') return res.status(400).json({ error: 'A folder doesn\'t have content' });
    let { localPath } = file;
    if (size) localPath = `${localPath}_${size}`;
    if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Content-Type', mime.lookup(file.name));
    return res.sendFile(localPath);
  }
}

module.exports = FilesController;
