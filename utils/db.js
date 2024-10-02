const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${host}:${port}`;
    this.dbClient = false;
    MongoClient.connect(uri, { useUnifiedTopology: true })
      .then((client) => {
        this.dbClient = client.db(database);
      })
      .catch((error) => {
        console.error(error);
        this.dbClient = false;
      });
  }

  isAlive() {
    return !!this.dbClient;
  }

  async nbUsers() {
    try {
      return await this.dbClient.collection('users').countDocuments();
    } catch (error) {
      console.error(error);
      return 0;
    }
  }

  async nbFiles() {
    try {
      return await this.dbClient.collection('files').countDocuments();
    } catch (error) {
      console.error(error);
      return 0;
    }
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
