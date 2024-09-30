const { MongoClient, ObjectId } = require('mongodb');
const { hashPassword, validateId } = require('./auth');

class DBClient {
  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = process.env.DB_PORT || 27017;
    this.database = process.env.DB_DATABASE || 'files_manager';
    this.url = `mongodb://${this.host}:${this.port}/${this.database}`;
    this.connectionEstablished = false;
    this.client = new MongoClient(this.url, { useUnifiedTopology: true });
    this.client
      .connect()
      .then(() => {
        this.connectionEstablished = true;
      })
      .catch((err) => {
        console.log('Mongo client failed to connect:', err.toString());
      });
  }

  isAlive() {
    return this.connectionEstablished;
  }

  async nbUsers() {
    return this.client.db().collection('users').countDocuments();
  }

  async nbFiles() {
    return this.client.db().collection('files').countDocuments();
  }

  async getUserByEmail(email) {
    return this.client.db().collection('users').findOne({ email });
  }

  async getUserById(id) {
    const _id = new ObjectId(id);
    return this.client.db().collection('users').findOne({ _id });
  }

  async createUser(email, password) {
    return this.client
      .db()
      .collection('users')
      .insertOne({ email, password: hashPassword(password) });
  }

  async getFileById(parentId) {
    const _id = validateId(parentId) ? new ObjectId(parentId) : null;
    return this.client.db().collection('files').findOne({ _id });
  }

  async getFileByUserId(fileId, userId) {
    const _id = validateId(fileId) ? new ObjectId(fileId) : null;

    return this.client
      .db()
      .collection('files')
      .findOne({
        _id,
        userId: new ObjectId(userId),
      });
  }

  async getAllFilesPaginated(filter, page) {
    return this.client
      .db()
      .collection('files')
      .aggregate([
        { $match: filter },
        { $sort: { _id: -1 } },
        { $skip: page * 20 },
        { $limit: 20 },
        {
          $project: {
            _id: 0,
            id: '$_id',
            userId: '$userId',
            name: '$name',
            type: '$type',
            isPublic: '$isPublic',
            parentId: {
              $cond: {
                if: { $eq: ['$parentId', '0'] },
                then: 0,
                else: '$parentId',
              },
            },
          },
        },
      ])
      .toArray();
  }

  async createFile(file) {
    return this.client.db().collection('files').insertOne(file);
  }

  async updateFile(fileFilter, status) {
    return this.client
      .db()
      .collection('files')
      .updateOne(fileFilter, { $set: { isPublic: status } });
  }
}

const dbClient = new DBClient();
export default dbClient;
