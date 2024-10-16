const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const app = express();
const PORT = process.env.PORT || 3000;
require('dotenv').config();

const LOYVERSE_API_TOKEN = process.env.LOYVERSE_API_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const API_URL = 'https://api.loyverse.com/v1.0/customers';
const customerPointCache = {}; // Store last known points balance

// Function to fetch customers from Loyverse
async function fetchCustomers() {
    try {
        const response = await axios.get(API_URL, {
            headers: {
                'Authorization': `Bearer ${LOYVERSE_API_TOKEN}`
            }
        });
        return response.data.customers;
    } catch (error) {
        console.error('Error fetching customers:', error.message);
        return [];
    }
}

// Function to trigger the Make.com webhook
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

// Function to check for point balance changes
async function checkForPointUpdates() {
    const customers = await fetchCustomers();

    for (const customer of customers) {
        const { id, display_name, loyalty_points } = customer;

        // Check if this customer is in our cache
        const previousPoints = customerPointCache[id] || 0;

        if (loyalty_points !== previousPoints) {
            console.log(`Points update detected for ${display_name}: ${previousPoints} -> ${loyalty_points}`);
            
            // Update the cache with the new points
            customerPointCache[id] = loyalty_points;

            // Trigger the webhook on Make.com
            await triggerMakeWebhook(customer);
        }
    }
}

// Schedule the point update check to run every minute
cron.schedule('* * * * *', checkForPointUpdates);

// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
