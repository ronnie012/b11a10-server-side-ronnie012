require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eyxn1x.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Created a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connected the client to the server
    await client.connect();
    console.log("Successfully connected to MongoDB!"); // Updated log

    // Defined database and collections
    const database = client.db("gigConnectDB");
    const tasksCollection = database.collection("tasks");
    const bidsCollection = database.collection("bids");

    // Made collections accessible to routes by attaching to app.locals
    app.locals.tasksCollection = tasksCollection;
    app.locals.bidsCollection = bidsCollection;


    // Basic route to confirm server is running
    app.get('/', (req, res) => {
      const htmlResponse = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-S">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>GigConnect Server - Online</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column; /* Align items vertically */
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); /* Vibrant gradient background */
              color: #ffffff; /* White text for contrast */
              text-align: center;
              overflow: hidden; /* Prevent scrollbars from gradient edges */
            }
            .container {
              text-align: center;
              padding: 20px; /* Adjusted padding */
            }
            h1 {
              font-size: 5.5rem; /* Larger heading */
              margin-bottom: 0.5em;
              font-weight: 300; /* Lighter font weight */
              letter-spacing: 1px;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.2); /* Subtle text shadow */
            }
            p {
              font-size: 1.5rem; /* Larger paragraph text */
              margin-bottom: 1em;
              font-weight: 300;
            }
            .status-dot {
              height: 15px;
              width: 15px;
              background-color: #4CAF50; /* Green dot for online status */
              border-radius: 50%;
              display: inline-block;
              margin-right: 10px;
              box-shadow: 0 0 20px #4CAF50, 0 0 40px #4CAF50; /* Glow effect */
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>GigConnect Server</h1>
            <p><span class="status-dot"></span>Online & Connected to MongoDB Database.</p>
            <p><small>API Version: v.1.0</small></p>
          </div>
        </body>
        </html>
      `;
      res.setHeader('Content-Type', 'text/html');
      res.status(200).send(htmlResponse);
    });

    // --- Task API Endpoints ---

    // POSTing a new task
    app.post('/api/v1/tasks', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      try {
        const taskData = req.body;

        if (!taskData) {
          return res.status(400).send({ message: 'Request body is missing or not in JSON format. Ensure Content-Type is application/json.' });
        }

        // Enhanced Validation
        const requiredFields = ['title', 'category', 'budget', 'deadline', 'description', 'creatorEmail', 'creatorName']; // Added creatorName
        const missingFields = requiredFields.filter(field => !(field in taskData) || !taskData[field]);

        if (missingFields.length > 0) {
          return res.status(400).send({ message: `Missing required task fields: ${missingFields.join(', ')}.` });
        }

        // Validated budget
        if (typeof taskData.budget !== 'number' || taskData.budget <= 0) {
          return res.status(400).send({ message: 'Budget must be a positive number.' });
        }

        // Validated category
        const allowedCategories = ['Web Development', 'Graphic Design', 'Digital Marketing', 'Writing & Translation', 'Video & Animation', 'General'];
        if (!allowedCategories.includes(taskData.category)) {
          return res.status(400).send({ message: `Invalid category. Allowed categories are: ${allowedCategories.join(', ')}.` });
        }

        // Validated deadline
        const deadlineDate = new Date(taskData.deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Did set today to the beginning of the day for comparison

        if (isNaN(deadlineDate.getTime()) || deadlineDate < today) {
          return res.status(400).send({ message: 'Deadline must be a valid date and set to a future date.' });
        }
        // Added a timestamp for when the task was created
        taskData.createdAt = new Date();

        const result = await tasksCollection.insertOne(taskData);
        res.status(201).send({ message: 'Task created successfully', taskId: result.insertedId });
      } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).send({ message: 'An internal server error occurred while creating the task.', dev_details: error.message });
      }
    });

    // GETting all tasks
    app.get('/api/v1/tasks', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const page = parseInt(req.query.page) || 1; // Default to page 1
      const limit = parseInt(req.query.limit) || 10; // Default to 10 tasks per page
      const skip = (page - 1) * limit;

      try {
        // Get the total count of tasks for pagination metadata
        const totalTasks = await tasksCollection.countDocuments({});

        const tasks = await tasksCollection.find({})
                                           .sort({ deadline: 1 }) // Sort by deadline, soonest first
                                           .skip(skip)
                                           .limit(limit)
                                           .toArray();
        res.status(200).send({
          tasks,
          totalTasks,
          totalPages: Math.ceil(totalTasks / limit),
          currentPage: page
        });
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send({ message: 'An internal server error occurred while fetching tasks.', dev_details: error.message });
      }
    });

    // GETting all tasks posted by a specific user (e.g., the current user)
    // This route must be defined BEFORE '/api/v1/tasks/:id' to avoid misinterpreting 'my-posted-tasks' as an ID.
    app.get('/api/v1/tasks/my-posted-tasks', async (req, res) => {
      console.log(`[${new Date().toISOString()}] SERVER HIT: /api/v1/tasks/my-posted-tasks. Query:`, req.query); // Diagnostic log
      const { tasksCollection } = req.app.locals;
      // Since there's no server-side authentication, the client must provide the identifier.
      // We'll use creatorEmail as per your existing similar route.
      // The client should send this as a query parameter: /api/v1/tasks/my-posted-tasks?creatorEmail=user@example.com
      const { creatorEmail } = req.query;

      if (!creatorEmail) {
        return res.status(400).send({ message: 'creatorEmail query parameter is required.' });
      }

      try {
        const postedTasks = await tasksCollection.find({ creatorEmail: creatorEmail }).sort({ createdAt: -1 }).toArray();
        res.status(200).send(postedTasks);
      } catch (error) {
        console.error('Error fetching user posted tasks:', error);
        res.status(500).send({ message: 'An internal server error occurred while fetching your posted tasks.', dev_details: error.message });
      }
    });
    // GETting featured tasks (top 6 by soonest deadline)
    app.get('/api/v1/featured-tasks', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      try {
        const featuredTasks = await tasksCollection.find({})
                                              .sort({ deadline: 1 }) // Sort by deadline, soonest first
                                              .limit(6) // Limit to 6 tasks
                                              .toArray();
        res.status(200).send(featuredTasks);
      } catch (error) {
        console.error('Error fetching featured tasks:', error);
        res.status(500).send({ message: 'An internal server error occurred while fetching featured tasks.', dev_details: error.message });
      }
    });

    // GETting a single task by ID
    app.get('/api/v1/tasks/:id', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const { id } = req.params;
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] GET /tasks/:id - Received ID string: "${id}"`);

      // Detailed check for tasksCollection
      if (!tasksCollection) {
        console.error(`[${timestamp}] GET /tasks/:id - FATAL: tasksCollection is undefined or null in app.locals.`);
        return res.status(500).send({ message: 'Server configuration error: Task collection not initialized.' });
      }
      console.log(`[${timestamp}] GET /tasks/:id - tasksCollection type: ${typeof tasksCollection}, collectionName: ${tasksCollection.collectionName}`);

      try {
        if (!ObjectId.isValid(id)) {
          console.log(`[${timestamp}] GET /tasks/:id - Invalid ID format for ID: "${id}"`);
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }
        const queryObjectId = new ObjectId(id);
        const queryForDb = { _id: queryObjectId };
        console.log(`[${timestamp}] GET /tasks/:id - Attempting tasksCollection.findOne with query:`, JSON.stringify(queryForDb));
        
        const task = await tasksCollection.findOne({ _id: new ObjectId(id) });
        if (!task) {
          console.log(`[${timestamp}] GET /tasks/:id - Task NOT FOUND by findOne for ObjectId: "${queryObjectId.toHexString()}"`);
          return res.status(404).send({ message: 'Task not found.' });
        }
        console.log(`[${timestamp}] GET /tasks/:id - Task FOUND for ObjectId: "${queryObjectId.toHexString()}"`);
        res.status(200).send(task);
      } catch (error) {
        console.error(`[${timestamp}] GET /tasks/:id - Error during task retrieval for ID "${id}":`, error);
        res.status(500).send({ message: 'An internal server error occurred while retrieving the task.', dev_details: error.message });
      }
    });

    // PUTting (updating) a task by ID
    app.put('/api/v1/tasks/:id', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const { id } = req.params;
      const updatePayload = { ...req.body };

      console.log(`[${new Date().toISOString()}] PUT /api/v1/tasks/:id - Received ID: ${id}`);
      console.log(`[${new Date().toISOString()}] PUT /api/v1/tasks/:id - Received payload:`, JSON.stringify(updatePayload, null, 2));

      try {
        if (!ObjectId.isValid(id)) {
          console.log(`[${new Date().toISOString()}] PUT /api/v1/tasks/:id - Invalid ID format for ID: ${id}`);
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }
        if (Object.keys(updatePayload).length === 0) { // Checked the copy
            console.log(`[${new Date().toISOString()}] PUT /api/v1/tasks/:id - Empty update payload for ID: ${id}`);
            return res.status(400).send({ message: 'Request body is empty. No update data provided.' });
        }

        // Log the exact query being made
        console.log(`[${new Date().toISOString()}] PUT /api/v1/tasks/:id - Querying for _id: new ObjectId("${id}")`);

        // Removed _id from updatePayload if present, as it shouldn't be updated
        delete updatePayload._id;

        // Prevented creatorEmail and creatorName from being updated
        if (updatePayload.hasOwnProperty('creatorEmail')) {
          delete updatePayload.creatorEmail; // Deleted from the copy
        }
        if (updatePayload.hasOwnProperty('creatorName')) {
          delete updatePayload.creatorName; // Deleted from the copy
        }
        // Added a timestamp for the update
        updatePayload.updatedAt = new Date();

        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatePayload } // Used the modified copy
        );

        console.log(`[${new Date().toISOString()}] PUT /api/v1/tasks/:id - Update result for ID ${id}:`, JSON.stringify(result, null, 2));

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'Task not found.' });
        }
        if (result.modifiedCount === 0 && result.matchedCount === 1) {
            return res.status(200).send({ message: 'Task found but no changes were applied (data might be the same).', modifiedCount: 0 });
        }

        res.status(200).send({ message: 'Task updated successfully', modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).send({ message: 'An internal server error occurred while updating the task.', dev_details: error.message });
      }
    });

    // DELETEd a task by ID
    app.delete('/api/v1/tasks/:id', async (req, res) => {
      const { tasksCollection } = req.app.locals;
      const { id } = req.params;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }
        const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).send({ message: 'Task not found.' });
        }
        res.status(204).send(); // Standard practice for successful deletion with no content to return
      } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).send({ message: 'An internal server error occurred while deleting the task.', dev_details: error.message });
      }
    });

    // --- Bid API Endpoints ---

    // POSTting a new bid on a specific task
    app.post('/api/v1/tasks/:taskId/bids', async (req, res) => {
      const { tasksCollection, bidsCollection } = req.app.locals;
      const { taskId } = req.params;
      const bidData = req.body; // Expected: { biddingAmount, bidderEmail, (optional) bidderDeadline, (optional) comment }

      try {
        if (!ObjectId.isValid(taskId)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }

        // Checked if the task exists
        const task = await tasksCollection.findOne({ _id: new ObjectId(taskId) });
        if (!task) {
          return res.status(404).send({ message: 'Task not found. Cannot place bid.' });
        }

        // Validation: User cannot bid on their own task
        if (task.creatorEmail === bidData.bidderEmail) {
          return res.status(403).send({ message: 'You cannot bid on your own task.' });
        }

        // Validation: Deadline for bidding has not passed (using task's deadline)
        const now = new Date();
        const taskDeadline = new Date(task.deadline); // Assuming task.deadline is a valid date string
        if (now > taskDeadline) {
          return res.status(403).send({ message: 'The deadline for bidding on this task has passed.' });
        }

        // Enhanced validation for bid data
        const requiredBidFields = ['biddingAmount', 'bidderEmail'];
        const missingBidFields = requiredBidFields.filter(field => !(field in bidData) || !bidData[field]);

        if (missingBidFields.length > 0) {
          return res.status(400).send({ message: `Missing required bid fields: ${missingBidFields.join(', ')}.` });
        }

        // Validated biddingAmount
        if (typeof bidData.biddingAmount !== 'number' || bidData.biddingAmount <= 0) {
          return res.status(400).send({ message: 'Bidding amount must be a positive number.' });
        }

        // Validated bidderDeadline if provided
        if (bidData.bidderDeadline) {
          const bidderDeadlineDate = new Date(bidData.bidderDeadline);
          if (isNaN(bidderDeadlineDate.getTime())) {
            return res.status(400).send({ message: 'Bidder deadline must be a valid date format if provided.' });
          }
        }

        const newBid = {
          taskId: new ObjectId(taskId),
          bidderEmail: bidData.bidderEmail,
          biddingAmount: parseFloat(bidData.biddingAmount),
          bidderDeadline: bidData.bidderDeadline, // Optional: freelancer's proposed deadline
          comment: bidData.comment, // Optional
          status: 'pending', // Default status
          bidPlacedAt: new Date()
        };

        const result = await bidsCollection.insertOne(newBid);
        res.status(201).send({ message: 'Bid placed successfully', bidId: result.insertedId });

      } catch (error) {
        console.error('Error placing bid:', error);
        res.status(500).send({ message: 'An internal server error occurred while placing your bid.', dev_details: error.message });
      }
    });

    // GETting all bids for a specific task
    app.get('/api/v1/tasks/:taskId/bids', async (req, res) => {
      const { bidsCollection } = req.app.locals;
      const { taskId } = req.params;
      try {
        if (!ObjectId.isValid(taskId)) {
          return res.status(400).send({ message: 'Invalid Task ID format.' });
        }

        const bids = await bidsCollection.find({ taskId: new ObjectId(taskId) }).sort({ bidPlacedAt: -1 }).toArray(); // Sort by newest bid first

        if (!bids || bids.length === 0) {
          return res.status(200).send([]); // Send empty array if no bids, still a success
        }
        res.status(200).send(bids);
      } catch (error) {
        console.error('Error fetching bids for task:', error);
        res.status(500).send({ message: 'An internal server error occurred while fetching bids for the task.', dev_details: error.message });
      }
    });

    // GETting all bids made by a specific user (bidder)
    app.get('/api/v1/my-bids', async (req, res) => {
      const { bidsCollection } = req.app.locals;
      const bidderEmail = req.query.bidderEmail;

      if (!bidderEmail) {
        return res.status(400).send({ message: 'bidderEmail query parameter is required.' });
      }

      try {
        // Finding all bids where the bidderEmail matches
        const myBids = await bidsCollection.find({ bidderEmail: bidderEmail }).sort({ bidPlacedAt: -1 }).toArray(); // Sorted by newest bid first

        // Sending the array of bids (could be empty)
        res.status(200).send(myBids);

      } catch (error) {
        console.error('Error fetching bids for bidder:', error);
        res.status(500).send({ message: 'An internal server error occurred while fetching your bids.', dev_details: error.message });
      }
    });

    // Starting the server only after a successful DB connection
    app.listen(port, () => {
      console.log(`GigConnect server is listening on port ${port}`);
    });

  } finally {
    // Ensures that the client will close when I finish/error
    // For a long-running server, I typically don't close the client here.
    // It will close when the Node.js process terminates.
    // await client.close();
  }
}
run().catch(console.dir);
