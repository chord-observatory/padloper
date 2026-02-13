import React, { useState, useEffect } from 'react';

import { styled } from '@mui/material/styles';
import {
    Button, Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Paper, Typography, Grid, TextField, IconButton,
    InputAdornment, Tooltip, Link, Box, Divider
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

import Authenticator from './components/Authenticator';
import { unixTimeToISOString } from './utility/utility';


function BulkInput() {
    // comment that will be added to the components
    const [comment, setComment] = useState("");

    // timestamp and time entry error states
    const [time, setTime] = useState(Math.floor(Date.now()));
    const [timeError, setTimeError] = useState("");

    // state variables to store the LTF and any potential errors
    const [ltf, setLtf] = useState("");
    const [ltfError, setLtfError] = useState("");
    const [ltfHelpOpen, setLtfHelpOpen] = useState(false);

    /**
     * Validate the Layout Text Format to ensure it is ready for submission
     * @todo
     */
    const validateLtf = (e) => {
        // split ltf into groups of lines where separated by blank line
        // const operations = ltf.split("\n\n").map((l) => l.split("\n"));
        // console.log(operations);
    }

    /**
     * Submit the LTF to the backend for processing
     */
    const handleSubmit = () => {
        if (!ltf) {
            setLtfError("LTF cannot be empty.");
            return;
        }

        if (timeError) {
            alert("Please fix the timestamp error before submitting.");
            return;
        }

        // Perform submission logic here
        console.log("Submitting form with data:");
        console.log("Timestamp:", time);
        console.log("Comment:", comment);
        console.log("LTF:", ltf);

        // Clear the form after submission
        setComment("");
        setLtf("");
        setTimeError("");
        setLtfError("");
    };

    return (
        <>
            <Authenticator />
            <Paper
                sx={{
                    mt: 4,
                    p: 4,
                    mb: 2,
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
                            Bulk Input
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            id="datetime-input"
                            label="Timestamp"
                            type="datetime-local"
                            fullWidth
                            defaultValue={unixTimeToISOString(time)}
                            onBlur={(e) => {
                                const date = Date.parse(e.target.value);
                                if (!isNaN(date)) {
                                    setTime(Math.round(date));
                                    setTimeError("");
                                } else {
                                    setTimeError("Invalid date.");
                                }
                            }}
                            error={timeError !== ""}
                            helperText={timeError}
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    </Grid>
                    <Grid item xs={6}>
                        <TextField
                            id="comment"
                            label="Comment"
                            fullWidth
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            id="bulk-input"
                            label="Enter LTF"
                            multiline
                            rows={10}
                            fullWidth
                            value={ltf}
                            onChange={(e) => setLtf(e.target.value)}
                            onBlur={validateLtf}
                            error={ltfError !== ""}
                            helperText={ltfError}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Tooltip title="What is LTF?">
                                            <IconButton
                                                color="primary"
                                                onClick={() => setLtfHelpOpen(true)}
                                                edge="end"
                                                sx={{
                                                    position: 'absolute',
                                                    top: 4,
                                                    right: 16,
                                                }}
                                            >
                                                <HelpOutlineIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={6} sx={{ textAlign: 'center' }}>
                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            disabled={timeError !== ""}
                        >
                            Preview LTF
                        </Button>
                    </Grid>
                    <Grid item xs={6} sx={{ textAlign: 'center' }}>
                        <Button
                            variant="outlined"
                            color="primary"
                            fullWidth
                            disabled={timeError !== ""}
                            onClick={handleSubmit}
                        >
                            Apply LTF
                        </Button>
                    </Grid>
                </Grid>
            </Paper>

            {/* Help Modal for LTF */}
            <Dialog
                open={ltfHelpOpen}
                onClose={() => setLtfHelpOpen(false)}
                aria-labelledby="ltf-help-dialog-title"
                aria-describedby="ltf-help-dialog-description"
            >
                <DialogTitle id="ltf-help-dialog-title">
                    <Typography variant="h5">Layout Text Format (LTF) Reference</Typography>
                </DialogTitle>
                <DialogContent>
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 1,
                            mb: 2,
                            textAlign: 'center',
                            // position: 'sticky',
                            // top: 0,
                            // zIndex: 1,
                            // backgroundColor: 'background.paper',
                            // padding: 1,
                        }}
                    >
                        <Link href="#ltf-making-connections" underline="hover" sx={{ color: 'text.secondary' }}>
                            Making Connections
                        </Link>
                        <Divider orientation="vertical" flexItem sx={{ height: 'auto' }} />
                        <Link href="#ltf-severing-connections" underline="hover" sx={{ color: 'text.secondary' }}>
                            Severing Connections
                        </Link>
                        <Divider orientation="vertical" flexItem sx={{ height: 'auto' }} />
                        <Link href="#ltf-setting-properties" underline="hover" sx={{ color: 'text.secondary' }}>
                            Setting Properties
                        </Link>
                        <Divider orientation="vertical" flexItem sx={{ height: 'auto' }} />
                        <Link href="#ltf-comments" underline="hover" sx={{ color: 'text.secondary' }}>
                            Comments
                        </Link>
                        <Divider orientation="vertical" flexItem sx={{ height: 'auto' }} />
                        <Link href="#ltf-multi-line" underline="hover" sx={{ color: 'text.secondary' }}>
                            Multi-line Entries
                        </Link>
                    </Box>
                    <Box id="ltf-making-connections" sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Making Connections
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <DialogContentText variant="body1">
                            todo
                        </DialogContentText>
                    </Box>
                    <Box id="ltf-severing-connections" sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Severing Connections
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <DialogContentText variant="body1">
                            todo
                        </DialogContentText>
                    </Box>
                    <Box id="ltf-setting-properties" sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Setting Component Properties
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <DialogContentText variant="body1">
                            todo
                        </DialogContentText>
                    </Box>
                    <Box id="ltf-comments" sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Comments and Blank Lines
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <DialogContentText variant="body1">
                            todo
                        </DialogContentText>
                    </Box>
                    <Box id="ltf-multi-line" sx={{ mt: 3 }}>
                        <Typography variant="h6" gutterBottom>
                            Multi-line Entries
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <DialogContentText variant="body1">
                            todo
                        </DialogContentText>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setLtfHelpOpen(false)} color="primary">
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    )
}

export default BulkInput;
