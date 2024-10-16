const express = require('express'); // Import Express framework
const axios = require('axios'); // Import Axios for making HTTP requests
const cron = require('node-cron'); // Import Node-Cron for scheduling tasks
require('dotenv').config(); // Import and configure dotenv to access environment variables

// Environment variables
const LOYVERSE_API_TOKEN = process.env.LOYVERSE_API_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const customerUrl = "https://api.loyverse.com/v1.0/customers"; // Loyverse API URL for customers

const app = express();
const PORT = process.env.PORT || 3000;

// Cache to store the last known points of each customer
const customerPointCache = {};

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
        const { id, display_name, loyalty_points } = customer;

        // Check if this customer is in our cache
        const previousPoints = customerPointCache[id] || 0;

        // Detect change in loyalty points
        if (loyalty_points !== previousPoints) {
            console.log(`Points update detected for ${display_name}: ${previousPoints} -> ${loyalty_points}`);
            
            // Update the cache with the new points
            customerPointCache[id] = loyalty_points;

            // Trigger the webhook on Make.com
            await triggerMakeWebhook(customer);
        }
    }
}

// Function to trigger the Make.com webhook with updated points information
async function triggerMakeWebhook(customer) {
    try {
        await axios.post(WEBHOOK_URL, {
            customer_id: customer.id,
            display_name: customer.display_name,
            new_points: customer.loyalty_points
        });
        console.log(`Webhook triggered for ${customer.display_name} with new points: ${customer.loyalty_points}`);
    } catch (error) {
        console.error('Error triggering webhook:', error.message);
    }
}

// Schedule the point update check to run every minute using node-cron
cron.schedule('* * * * *', checkForPointUpdates);

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Checking for customer point updates every minute...');
});
