import https from 'https';

export const httpsAgentIPv4 = new https.Agent({
  family: 4, // 👈 força IPv4
});
