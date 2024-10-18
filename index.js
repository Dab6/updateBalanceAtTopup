const express = require('express'); // Import Express framework
const axios = require('axios'); // Import Axios for making HTTP requests
require('dotenv').config(); // Import and configure dotenv to access environment variables

// Environment variables
const LOYVERSE_API_TOKEN = process.env.LOYVERSE_API_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const customerUrl = "https://api.loyverse.com/v1.0/customers"; // Loyverse API URL for customers

const app = express();
const PORT = process.env.PORT || 3000;

// Cache to store the last known points of each customer
let customerPointCache = {};
let isFirstRun = true; // Flag to indicate the first run

// Function to fetch customers from Loyverse
async function fetchCustomers() {
    try {
        const response = await axios.get(customerUrl, {
            headers: {
                'Authorization': `Bearer ${LOYVERSE_API_TOKEN}`
            }
        });
        // Ensure the response data contains customers
        if (response.data && response.data.customers) {
            return response.data.customers;
        } else {
            console.error('Unexpected response format:', response.data);
            return [];
        }
    } catch (error) {
        console.error('Error fetching customers from Loyverse:', error.message);
        return [];
    }
}

// Function to check for point balance changes
async function checkForPointUpdates() {
    const customers = await fetchCustomers();

    for (const customer of customers) {
        const { id, name, total_points } = customer;

        // Check if this customer is in our cache
        const previousPoints = customerPointCache[id] || 0;

        // Initialize the cache during the first run without triggering the webhook
        if (isFirstRun) {
            customerPointCache[id] = total_points;
        } else if (total_points !== previousPoints) {
            console.log(`Points update detected for ${name}: ${previousPoints} -> ${total_points}`);

            // Update the cache with the new points
            customerPointCache[id] = total_points;

            // Trigger the webhook for this customer
            await triggerMakeWebhook(customer);
        }
    }

    // After the first run, set the flag to false
    if (isFirstRun) {
        console.log('Cache initialized on first run.');
        isFirstRun = false;
    }
}

// Function to trigger the Make.com webhook with updated points information
async function triggerMakeWebhook(customer) {
    try {
        await axios.post(WEBHOOK_URL, {
            customer_id: customer.id,
            name: customer.name,
            new_points: customer.total_points,
            email: customer.email,
            phone_number: customer.phone_number,
            total_spent: customer.total_spent
        });
        console.log(`Webhook triggered for ${customer.name} with new points: ${customer.total_points}`);
    } catch (error) {
        console.error('Error triggering webhook:', error.message);
    }
}

// Endpoint to manually check for point updates
app.get('/check-updates', async (req, res) => {
    await checkForPointUpdates();
    res.send('Checked for customer point updates.');
});

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Manual update check endpoint available at /check-updates');
});
