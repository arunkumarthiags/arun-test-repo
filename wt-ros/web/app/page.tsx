'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Root page - redirects to work-tracking dashboard
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/work-tracking');
  }, [router]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        gap: 2,
      }}
    >
      <CircularProgress />
      <Typography variant="body2" color="text.secondary">
        Loading WT-ROS...
      </Typography>
    </Box>
  );
}
