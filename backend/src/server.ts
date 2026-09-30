import app from './app';
import { env } from './config/env';

const startServer = () => {
  app.listen(env.PORT, () => {
    console.log(`Server started in ${env.NODE_ENV} mode on port ${env.PORT}`);
  });
};

startServer();
