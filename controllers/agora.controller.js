const { RtcTokenBuilder, RtmTokenBuilder, RtcRole } = require('agora-token');

exports.generateToken = (req, res) => {
    const { channelName } = req.params;
    let { uid } = req.query; 

    if (!channelName || !uid) {
        return res.status(400).json({ error: 'Channel name and UID are required' });
    }

    const APP_ID = "1322a6062e06499d87f48b99088954e8";
    const APP_CERTIFICATE = "28b8fe195e7a4bca8d98fdd6836ba227";
    
    const expirationInSeconds = 3600; 
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationInSeconds;

    try {
        // 1. Generate Video Token (RTC)
        const rtcToken = RtcTokenBuilder.buildTokenWithUid(
            APP_ID, 
            APP_CERTIFICATE, 
            channelName, 
            parseInt(uid, 10), 
            RtcRole.PUBLISHER, 
            expirationInSeconds,
            privilegeExpiredTs
        );

        // 2. Generate Chat Token (RTM 2.0) - Exactly 4 arguments
        const rtmToken = RtmTokenBuilder.buildToken(
            APP_ID, 
            APP_CERTIFICATE, 
            uid.toString(), 
            privilegeExpiredTs
        );

        return res.status(200).json({ 
            success: true, 
            rtcToken,     
            rtmToken,     
            appId: APP_ID, 
            channelName, 
            uid: uid.toString()
        });
    } catch (error) {
        console.error("Token Generation Error:", error);
        return res.status(500).json({ success: false, error: "Failed to generate tokens" });
    }
};