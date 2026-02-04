import React, { useState, useEffect } from 'react';

import { styled } from '@mui/material/styles';
import { Paper, Typography, Grid, Stack, Box, Button } from '@mui/material';

import Authenticator from './components/Authenticator';


const Item = styled(Paper)(({ theme }) => ({
    backgroundColor: '#fff',
    ...theme.typography.body2,
    padding: theme.spacing(1),
    textAlign: 'center',
    color: (theme.vars ?? theme).palette.text.secondary,
    ...theme.applyStyles('dark', {
        backgroundColor: '#1A2027',
    }),
}))

function Barcode() {
    return (
        <>
            <Authenticator />
            <Paper
                // style={{
                //     marginTop: '16px',
                //     paddingTop: '8px',
                //     paddingBottom: '8px',
                //     flexGrow: 1,
                //     marginBottom: '8px',
                //     textAlign: 'center',
                //     display: 'grid',
                //     justifyContent: 'space-between',
                //     rowGap: '8px',
                //     width: '600px',
                //     maxWidth: '100%',
                //     margin: 'auto',
                // }}
                sx={{
                    // display: 'flex',
                    // flexDirection: 'column',
                    // flexGrow: 1,
                    // alignSelf: 'center',
                    mt: 4,
                    p: 4,
                    mb: 2,
                    // g: 2,
                    // justifyContent: 'space-between',
                    margin: 'auto',
                    width: '100%',
                    maxWidth: {
                        md: '600px',
                    },
                }}
            >
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Typography
                            component="h1"
                            variant="h5"
                            sx={{ textAlign: 'center' }}
                        >
                            Barcode Scanner
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Button fullWidth variant="contained">Item 1</Button>
                    </Grid>
                    <Grid item xs={6}>
                        <Button fullWidth>Item 2</Button>
                    </Grid>
                </Grid>
            </Paper>
        </>
    )
}

export default Barcode;
