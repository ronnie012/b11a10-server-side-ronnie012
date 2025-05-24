# GigConnect - Server API

This repository contains the server-side API for GigConnect, a freelance marketplace platform. It handles all backend logic, including task management, bidding, and interactions with the MongoDB database.

**Live Site URL:** 
https://gig-connect-server.vercel.app

## Tech Stack

*   **Node.js:** JavaScript runtime environment.
*   **Express.js:** Web application framework for Node.js.
*   **MongoDB:** NoSQL database used for data storage.
*   **Mongoose ODM:** (Currently using native MongoDB driver, but Mongoose is a common alternative for schema validation and object modeling if considered later).
*   **dotenv:** For managing environment variables.
*   **cors:** For enabling Cross-Origin Resource Sharing.

## Project Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Programming-Hero-Web-Course4/b11a10-server-side-ronnie012

    cd into the project directory.
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Environment Variables:**
    Create a `.env` file in the root of the `gig-connect-server` directory and add the following variables with your MongoDB Atlas credentials and desired port:
    ```env
    DB_USER=<your_mongodb_username>
    DB_PASS=<your_mongodb_password>
    PORT=3000 # Or any other port you prefer
    ```
    Replace `<your_mongodb_username>` and `<your_mongodb_password>` with your actual credentials.

## Running the Server

*   **Development Mode (with automatic restarts on file changes):**
    If you have `nodemon` installed locally as a dev dependency, you can add a script to your `package.json`:
    ```json
    // package.json
    "scripts": {
      "start": "node index.js",
      "dev": "nodemon index.js"
    }
    ```
    Then run:
    ```bash
    npm run dev
    ```

*   **Production Mode:**
    ```bash
    npm start
    ```

## API Endpoints

The server provides various RESTful API endpoints for managing tasks and bids. Key functionalities include:
*   Task CRUD (Create, Read, Update, Delete) operations.
*   Fetching tasks by creator.
*   Fetching featured tasks.
*   Placing bids on tasks.
*   Retrieving bids for a specific task or by a specific bidder.

*(For detailed endpoint paths and request/response formats, please refer to the API documentation or the route definitions in `index.js`.)*

## Deployment

This server is intended to be deployed on Vercel or a similar platform.

