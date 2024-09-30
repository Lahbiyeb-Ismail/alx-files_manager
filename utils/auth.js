import sha1 from 'sha1';
import redisClient from './redis';
import dbClient from './db';

export const hashPassword = (password) => sha1(password);

export const getToken = (authHeader) => {
  const head = authHeader.substring(0, 5);

  if (head !== 'Basic') {
    return null;
  }
  return authHeader.substring(6);
};

export const decodeToken = (token) => {
  const decoded = Buffer.from(token, 'base64').toString('utf8');

  if (!decoded.includes(':')) {
    return null;
  }
  return decoded;
};

export const getCreds = (decoded) => {
  const [email, password] = decoded.split(':');

  if (!email || !password) {
    return null;
  }
  return { email, password };
};

export const getUserByToken = async (req) => {
  const token = req.headers['x-token'];

  if (!token) {
    return null;
  }
  const userId = await redisClient.get(`auth_${token}`);

  if (!userId) {
    return null;
  }
  const fetchedUser = await dbClient.getUserById(userId);
  return fetchedUser;
};

export const validateId = (id) => {
  const size = 24;
  let i = 0;
  const charRanges = [
    [48, 57], // 0 - 9
    [97, 102], // a - f
    [65, 70], // A - F
  ];
  if (typeof id !== 'string' || id.length !== size) {
    return false;
  }
  while (i < size) {
    const c = id[i];
    const code = c.charCodeAt(0);

    if (!charRanges.some((range) => code >= range[0] && code <= range[1])) {
      return false;
    }
    i += 1;
  }
  return true;
};
