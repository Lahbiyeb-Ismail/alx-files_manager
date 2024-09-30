import { v4 as uuid4 } from 'uuid';
import RedisClient from '../utils/redis';
import DBClient from '../utils/db';

const { ObjectId } = require('mongodb');
const fs = require('fs');
const mime = require('mime-types');
const Bull = require('bull');

export default class FilesController {
  static async postUpload(req, res) {
    const fileQueue = new Bull('fileQueue');

    const token = req.header('X-Token') || null;
    if (!token) return res.status(401).send({ error: 'Unauthorized' });

    const redisToken = await RedisClient.get(`auth_${token}`);
    if (!redisToken) return res.status(401).send({ error: 'Unauthorized' });

    const user = await DBClient.db
      .collection('users')
      .findOne({ _id: ObjectId(redisToken) });
    if (!user) return res.status(401).send({ error: 'Unauthorized' });

    const fileName = req.body.name;
    if (!fileName) return res.status(400).send({ error: 'Missing name' });

    const fileType = req.body.type;
    if (!fileType || !['folder', 'file', 'image'].includes(fileType))
      return res.status(400).send({ error: 'Missing type' });

    const fileData = req.body.data;
    if (!fileData && ['file', 'image'].includes(fileType))
      return res.status(400).send({ error: 'Missing data' });

    const fileIsPublic = req.body.isPublic || false;

    let fileParentId = req.body.parentId || 0;
    fileParentId = fileParentId === '0' ? 0 : fileParentId;

    if (fileParentId !== 0) {
      const parentFile = await DBClient.db
        .collection('files')
        .findOne({ _id: ObjectId(fileParentId) });
      if (!parentFile)
        return res.status(400).send({ error: 'Parent not found' });
      if (parentFile.type !== 'folder')
        return res.status(400).send({ error: 'Parent is not a folder' });
    }

    const fileDataDb = {
      userId: user._id,
      name: fileName,
      type: fileType,
      isPublic: fileIsPublic,
      parentId: fileParentId,
    };

    if (fileDataDb.type === 'folder') {
      await DBClient.db.collection('files').insertOne(fileDataDb);
      return res.status(201).send({
        id: fileDataDb._id,
        userId: fileDataDb.userId,
        name: fileDataDb.name,
        type: fileDataDb.type,
        isPublic: fileDataDb.isPublic,
        parentId: fileDataDb.parentId,
      });
    }

    const pathDir = process.env.FOLDER_PATH || '/tmp/files_manager';
    const fileUuid = uuid4();

    const buff = Buffer.from(fileData, 'base64');
    const pathFile = `${pathDir}/${fileUuid}`;

    fs.mkdir(pathDir, { recursive: true }, (error) => {
      if (error) return res.status(400).send({ error: error.message });
      return true;
    });

    fs.writeFile(pathFile, buff, (error) => {
      if (error) return res.status(400).send({ error: error.message });
      return true;
    });

    fileDataDb.localPath = pathFile;
    await DBClient.db.collection('files').insertOne(fileDataDb);

    fileQueue.add({
      userId: fileDataDb.userId,
      fileId: fileDataDb._id,
    });

    return res.status(201).send({
      id: fileDataDb._id,
      userId: fileDataDb.userId,
      name: fileDataDb.name,
      type: fileDataDb.type,
      isPublic: fileDataDb.isPublic,
      parentId: fileDataDb.parentId,
    });
  }

  static async getShow(req, res) {
    const fetchedUser = await getUserByToken(req);

    if (!fetchedUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const userId = fetchedUser._id.toString();
    const file = await dbClient.getFileByUserId(id, userId);

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }
    return res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: file.isPublic,
      parentId: file.parentId.toString(),
    });
  }

  static async getIndex(req, res) {
    const fetchedUser = await getUserByToken(req);

    if (!fetchedUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const parentId = req.query.parentId || '0';
    const page = /\d+/.test((req.query.page || '').toString())
      ? Number.parseInt(req.query.page, 10)
      : 0;

    const fileFilter =
      parentId === '0'
        ? { userId: fetchedUser._id }
        : {
            userId: fetchedUser._id,
            parentId: validateId(parentId)
              ? new mongo.ObjectID(parentId)
              : null,
          };
    const files = await dbClient.getAllFilesPaginated(fileFilter, page);

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const fetchedUser = await getUserByToken(req);

    if (!fetchedUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const userId = fetchedUser._id.toString();
    const file = await dbClient.getFileByUserId(id, userId);

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileFilter = {
      _id: new mongo.ObjectID(id),
      userId: new mongo.ObjectID(userId),
    };
    await dbClient.updateFile(fileFilter, true);
    return res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: true,
      parentId: file.parentId.toString(),
    });
  }

  static async putUnpublish(req, res) {
    const fetchedUser = await getUserByToken(req);

    if (!fetchedUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = req.params;
    const userId = fetchedUser._id.toString();
    const file = await dbClient.getFileByUserId(id, userId);

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    const fileFilter = {
      _id: new mongo.ObjectID(id),
      userId: new mongo.ObjectID(userId),
    };
    await dbClient.updateFile(fileFilter, false);
    return res.status(200).json({
      id,
      userId,
      name: file.name,
      type: file.type,
      isPublic: false,
      parentId: file.parentId.toString(),
    });
  }

  static async getFile(req, res) {
    const fetchedUser = await getUserByToken(req);
    const userId = fetchedUser ? fetchedUser._id.toString() : '';
    const { id } = req.params;
    const size = req.query.size || null;
    const file = await dbClient.getFileById(id);

    if (!file || (!file.isPublic && file.userId.toString() !== userId)) {
      return res.status(404).json({ error: 'Not found' });
    }
    if (file.type === FILE_TYPES.folder) {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }
    let filePath = file.localPath;

    if (size) {
      filePath = `${file.localPath}_${size}`;
    }
    if (existsSync(filePath)) {
      const fileInfo = await statAsync(filePath);

      if (!fileInfo.isFile()) {
        return res.status(404).json({ error: 'Not found' });
      }
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
    const absoluteFilePath = await realpathAsync(filePath);
    res.setHeader(
      'Content-Type',
      contentType(file.name) || 'text/plain; charset=utf-8'
    );

    return res.status(200).sendFile(absoluteFilePath);
  }
}
