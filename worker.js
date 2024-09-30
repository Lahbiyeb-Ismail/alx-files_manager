import { writeFile } from 'fs';
import { promisify } from 'util';
import Queue from 'bull/lib/queue';
import imgThumbnail from 'image-thumbnail'; // Needs Node v14 or above to work.
import dbClient from './utils/db';

const writeFileAsync = promisify(writeFile);
const fileQueue = new Queue('thumbnail generation');
const userQueue = new Queue('email sending');

async function generateThumbnail(filePath, size) {
  const buffer = await imgThumbnail(filePath, { width: size });
  console.log(`Generating file: ${filePath}, size: ${size}`);
  return writeFileAsync(`${filePath}_${size}`, buffer);
}

fileQueue.process(async (job, done) => {
  const fileId = job.data.fileId || null;
  const userId = job.data.userId || null;

  if (!fileId) {
    throw new Error('Missing fileId');
  }
  if (!userId) {
    throw new Error('Missing userId');
  }
  const file = await dbClient.getFileByUserId(fileId, userId);

  if (!file) {
    throw new Error('File not found');
  }
  const sizeList = [500, 250, 100];

  Promise.all(
    sizeList.map((size) => generateThumbnail(file.localPath, size)),
  ).then(() => done());
});

userQueue.process(async (job, done) => {
  const userId = job.data.userId || null;

  if (!userId) {
    throw new Error('Missing userId');
  }
  const fetchedUser = await dbClient.getUserById(userId);

  if (!fetchedUser) {
    throw new Error('User not found');
  }
  console.log(`Welcome ${fetchedUser.email}!`);
  done();
});
