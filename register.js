const axios = require('axios');

const ACCESS_TOKEN = "EAAUDXhZB1mOsBQ19rLSDZAUe4WCP5CAEgzjztkZA8U1SjZCctfZC9cwRQCOuGsNjFoO6FZBZBR00Np1puFcVSKpI9jxNXK0suZABnyEUIuCJk1om5O26RDYkqysV1OU8gA9PPjnSBS3u9eeIURaS8xNN9vRYQe1We6UZAESvw2qSI0DXWPZB8C6n5PR9VOsHq2BvrUaQZDZD";
const PHONE_NUMBER_ID = "964165030115165";
const TWO_STEP_PIN = "123456"; // ← change this

async function registerNumber() {
    try {
        const response = await axios.post(
            `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/register`,
            {
                messaging_product: "whatsapp",
                pin: TWO_STEP_PIN
            },
            {
                headers: {
                    "Authorization": `Bearer ${ACCESS_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("✅ Registration successful!");
        console.log(JSON.stringify(response.data, null, 2));

    } catch (error) {
        console.error("❌ Registration failed!");
        console.error(JSON.stringify(error.response?.data || error.message, null, 2));
    }
}

registerNumber();