// import { error } from 'console';
import mongo from 'mongodb';
import { tmpdir } from 'os';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import { v4 } from 'uuid';
import {
  mkdir, writeFile, stat, existsSync, realpath,
} from 'fs';
import { join as joinPath } from 'path';
import { contentType } from 'mime-types';
import dbClient from '../utils/db';
import { getUserByToken, validateId } from '../utils/auth';

const fileQueue = new Queue('thumbnail generation');
const mkDirAsync = promisify(mkdir);
const writeFileAsync = promisify(writeFile);
const statAsync = promisify(stat);
const realpathAsync = promisify(realpath);
const FILE_TYPES = {
  folder: 'folder',
  file: 'file',
  image: 'image',
};

export default class FilesController {
  static async postUpload(req, res) {
    const fetchedUser = await getUserByToken(req);

    if (!fetchedUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }
    const { type } = req.body;

    if (!type || !Object.values(FILE_TYPES).includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }
    const parentId = req.body.parentId || 0;
    const isPublic = req.body.isPublic || false;
    const { data } = req.body;

    if (!req.body.data && type !== FILE_TYPES.folder) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== 0 && parentId !== '0') {
      const file = await dbClient.getFileById(parentId);

      if (!file) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (file.type !== FILE_TYPES.folder) {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    const userId = fetchedUser._id.toString();
    const baseDir = `${process.env.FOLDER_PATH || ''}`.trim().length > 0
      ? process.env.FOLDER_PATH.trim()
      : joinPath(tmpdir(), 'files_manager');
    const newFile = {
      userId: new mongo.ObjectID(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 || parentId === '0'
        ? '0' : new mongo.ObjectID(parentId),
    };
    await mkDirAsync(baseDir, { recursive: true });

    if (type !== FILE_TYPES.folder) {
      const localPath = joinPath(baseDir, v4());
      await writeFileAsync(localPath, Buffer.from(data, 'base64'));
      newFile.localPath = localPath;
    }
    const insertedFile = await dbClient.createFile(newFile);
    const fileId = insertedFile.insertedId.toString();

    if (type === FILE_TYPES.image) {
      const jobName = `Image thumbnail [${userId}-${fileId}]`;
      fileQueue.add({ userId, fileId, name: jobName });
    }
    return res.status(201).json({
      id: fileId,
      userId,
      name,
      type,
      isPublic,
      parentId: parentId === 0 || parentId === '0'
        ? '0' : new mongo.ObjectID(parentId),
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

    const fileFilter = parentId === '0'
      ? { userId: fetchedUser._id }
      : {
        userId: fetchedUser._id,
        parentId: validateId(parentId) ? new mongo.ObjectID(parentId) : null,
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
      contentType(file.name) || 'text/plain; charset=utf-8',
    );

    return res.status(200).sendFile(absoluteFilePath);
  }
}
