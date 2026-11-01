import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8000;

app.use(cors());

const client = new MongoClient(process.env.MONGODB_URL?.trim());

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
    return client;
  }
}

await connectToMongoDB();
const db = client.db("studiospace");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});
