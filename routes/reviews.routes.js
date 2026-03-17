const express = require('express');
const router = express.Router();

let cachedReviews = null;
let cacheTime = null;
const CACHE_DURATION = 6 * 60 * 60 * 1000;

router.get('/api/reviews', async (req, res) => {
    if (cachedReviews && (Date.now() - cacheTime) < CACHE_DURATION) {
        return res.json(cachedReviews);
    }

    const PLACE_ID = process.env.PLACE_ID;
    const API_KEY = process.env.API_KEY;

    try {
        const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${PLACE_ID}&fields=reviews,rating,user_ratings_total&key=${API_KEY}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.status !== 'OK') {
            return res.status(500).json({ error: data.status, message: data.error_message });
        }


        const reviews = data.result.reviews.map(r => ({
            text: r.text,
            name: r.author_name,
            role: 'Google Review',
            rating: r.rating,
            time: r.relative_time_description,
            photo: r.profile_photo_url,
        }));
        console.log('data:', data.result.reviews);

        // ✅ Store in variables first, cache, then send ONE response
        const rating = data.result.rating;
        const total = data.result.user_ratings_total;

        cachedReviews = { reviews, rating, total };
        cacheTime = Date.now();


        return res.json(cachedReviews); // ✅ Only ONE res.json()

    } catch (err) {
        console.error('Google Reviews error:', err);
        res.status(500).json({ error: 'Failed to fetch reviews' });
    }
});

module.exports = router;