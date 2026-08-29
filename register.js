const axios = require('axios');

const ACCESS_TOKEN = "EAAX9QZBIFwCwBSNX9FCw6C5gTL9f19RJQk6C6ZBJBBOJEZCI5cxYzlSZCe4EAPQIcbyDB2NnuTbmTwwWPiOXa06MXCPBKjVjQFi8HTxK6hISZAyjH9SpDnEjde9dlrLIgCRCtl5f2hSJbJ3C1pTEYZCrsREn3Jqm7eRZBfZBbLV27VO1ytIbxROCBjoyxRpfQ33VAn2GnC6GU7EURWCsF5nBTLvkVueckEPP91SgprJPjfFvD3apcesTI2ui4L9H0vW6DLqvnWnzwmqmtWpW43OLclNEGEiqD6sbvcs6sgZDZD";
const PHONE_NUMBER_ID = "1349155758272965";
const TWO_STEP_PIN = "684028"; // ← change this

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