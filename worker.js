import Queue from 'bull';
import { ObjectId } from 'mongodb';
import fs from 'fs';
import imageThumb from 'image-thumbnail';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue');
const userQueue = new Queue('userQueue');

fileQueue.process(async (job) => {
  try {
    const { fileId, userId } = job.data;

    if (!fileId) {
      throw new Error('Missing fileId');
    }
    if (!userId) {
      throw new Error('Missing userId');
    }
    const file = await dbClient.dbClient.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    if (!file) {
      throw new Error('File not found');
    }
    const dir = file.localPath;
    fs.writeFileSync(`${dir}_500`, await imageThumb(dir, { width: 500 }));
    fs.writeFileSync(`${dir}_250`, await imageThumb(dir, { width: 250 }));
    fs.writeFileSync(`${dir}_100`, await imageThumb(dir, { width: 100 }));
  } catch (err) {
    console.error(err);
  }
});

userQueue.process(async (job) => {
  try {
    const { userId } = job.data;
    if (!userId) {
      throw new Error('Missing userId');
    }
    const user = await dbClient.dbClient.collection('users').findOne({ _id: ObjectId(userId) });
    if (!user) {
      throw new Error('User not found');
    }
    console.log(`Welcome ${user.email}!`);
  } catch (err) {
    console.error('cannot send email');
  }
});

export { fileQueue, userQueue };
