import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { createRemoteJWKSet, jwtVerify } from "jose";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 8000;

const allowedOrigins = [
  "https://studiospace-frontend-theta.vercel.app",
  "http://localhost:3000",
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

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
const studioCollection = db.collection("studios");
const bookingCollection = db.collection("bookings");

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).send({ msg: "Unauthorized!" });
  }

  const clientUrl = (
    process.env.CLIENT_URL || "https://studiospace-frontend-theta.vercel.app"
  ).replace(/\/+$/, "");

  const JWKS = createRemoteJWKSet(
    new URL(`${clientUrl}/api/auth/jwks`),
  );

  try { 
    const { payload } = await jwtVerify(token, JWKS);
    next();
  } catch (error) {
    return res.status(500).send({ msg: "Server Error!" });
  }
};

app.post("/add-studio", verifyToken, async (req, res) => {
  const data = req.body;
  const result = await studioCollection.insertOne(data);
  res.send(result);
});

app.get("/studios", async (req, res) => {
  const result = await studioCollection.find().toArray();
  res.send(result);
});

app.get("/studios/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await studioCollection.findOne({ _id: new ObjectId(id) });
    if (!result) {
      return res.status(404).send({ msg: "Studio not found" });
    }
    res.send(result);
  } catch (error) {
    res.status(400).send({ msg: "Invalid studio ID" });
  }
});

app.put("/edit-studio/:id", verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { _id, ...updateData } = req.body;
    const result = await studioCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ msg: "Failed to update studio" });
  }
});

app.post("/bookings", async (req, res) => {
  try {
    const bookingData = {
      ...req.body,
      status: req.body.status || "Pending",
      createdAt: req.body.createdAt || new Date().toISOString(),
    };
    const result = await bookingCollection.insertOne(bookingData);
    res.status(201).send(result);
  } catch (error) {
    res.status(500).send({ msg: "Failed to create booking" });
  }
});

app.get("/bookings", async (req, res) => {
  try {
    const email = req.query.email;
    const query = email ? { userEmail: String(email) } : {};
    const result = await bookingCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  } catch (error) {
    res.status(500).send({ msg: "Failed to fetch bookings" });
  }
});

app.patch("/bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body.status || "Cancelled";
    const result = await bookingCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date().toISOString(),
        },
      }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ msg: "Failed to update booking status" });
  }
});

app.put("/bookings/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body.status || "Cancelled";
    const result = await bookingCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status,
          updatedAt: new Date().toISOString(),
        },
      }
    );
    res.send(result);
  } catch (error) {
    res.status(500).send({ msg: "Failed to update booking status" });
  }
});

app.get("/", (req, res) => {
  res.send({message: "Server is running fine!"});
});

app.listen(PORT, () => {
  console.log(`Example app listening on port ${PORT}`);
});

export default app;