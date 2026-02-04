import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { Button, FormControl, MenuItem, TextField, Select } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';

import { withBase, requireOkJson } from './paths.js';
import Authenticator from './components/Authenticator.js';
import ElementList from './ElementList.js';
import ElementRangePanel from './ElementRangePanel.js';
import ErrorMessage from './ErrorMessage.js';
import ComponentSequenceAddButton from './ComponentSequenceAddButton.js';

/**
 * A MUI component that represents a list of component sequences
 */
function ComponentSequenceList() {
    // the list of component sequences
    const [sequences, setSequences] = useState([]);

    // the first sequence index to show
    const [min, setMin] = useState(0);

    // how many sequences there are
    const [count, setCount] = useState(0);

    // the number of sequences to show
    const [range, setRange] = useState(100);

    // whether the sequences are loaded or not
    const [loaded, setLoaded] = useState(false);

    // property to order the sequences by
    // must be in the set {'name', 'component_type', 'prefix'}
    const [orderBy, setOrderBy] = useState('name');

    // error data to display, if any
    const [errorData, setErrorData] = useState(null);

    // ordering direction, 'asc' or 'desc'
    const [orderDirection, setOrderDirection] = useState('asc');

    // filters stored as list of objects
    const [filters, setFilters] = useState([]);

    // store the available component types as list of objects (future-proof)
    const [componentTypes, setComponentTypes] = useState([])

    // Update the state after a new component is added
    const [reloadBool, setReloadBool] = useState(false);
    function toggleReload() {
        setReloadBool(!reloadBool);
    }

    /**
     * Load the data when the site is loaded or when filter state changes.
     * Also reload the data when reload specifically requested by reloadBool.
     */
    useEffect(() => {
        async function fetchData() {
            setLoaded(false);

            // set up query url
            let path = '/api/component_sequence_list';
            path += `?range=${min};${min+range}`;
            path += `&orderBy=${orderBy}`;
            path += `&orderDirection=${orderDirection}`;
            // implement filters later

            // query the URL and set the inputs
            fetch(withBase(path)).then(requireOkJson).then((data) => {
                if (data.result && typeof(data.result) === 'object') {
                    setErrorData(null);
                    setSequences(data.result);
                    setCount(data.result.length);
                    setLoaded(true);
                } else {
                    setSequences([]);
                    setCount(0);
                    setErrorData(JSON.parse(data.error));
                    setLoaded(true);
                }
            }).catch((err) => {
                console.error('Failed to load sequence list:', err);
                setSequences([]);
                setCount(0);
                setErrorData(err.message);
                setLoaded(true);
            });
        }
        fetchData();
    }, [min, range, orderBy, orderDirection, reloadBool]);

    /**
     * Function to load component types
     */
    useEffect(() => {
        // set the query url
        let path = "/api/component_type_list";
        path += `?range=0;100   `;
        path += `&orderBy=name`;
        path += `&orderDirection=asc`;
        path += `&nameSubstring=`;

        fetch(withBase(path)).then(requireOkJson).then((data) => {
            if (data.result && typeof(data.result) === 'object') {
                setComponentTypes(data.result);
            } else {
                setErrorData(data.error);
            }
        }).catch((err) => {
            console.error('Failed to load component types:', err);
            setComponentTypes([]);
            setErrorData(err.message);
        });
    }, []);

    // state variables for add/edit mode
    const [editMode, setEditMode] = useState(false); // (de)activate edit mode
    const [editSeq, setEditSeq] = useState(''); // name of sequence to edit
    const [name, setName] = useState('');
    const [componentType, setComponentType] = useState({});
    const [prefix, setPrefix] = useState('');
    const [seqSize, setSeqSize] = useState(0);
    const [nextSeq, setNextSeq] = useState(0);

    const handleEdit = (seqName) => {
        setEditSeq(seqName);

        // load all the temporary data
        let seq = sequences.find((s) => s.name === seqName);
        setName(seq.name);
        setComponentType(seq.component_type.name);
        setPrefix(seq.prefix);
        setSeqSize(seq.seq_size);
        setNextSeq(seq.next_seq);

        // everything loaded so activate edit mode
        setEditMode(true);
    };

    const handleSave = () => {
        setEditSeq('');
        setEditMode(false);
    }

    // header cells of the table
    const tableHeadCells = [
        {id: 'name', label: 'Sequence Name', allowOrdering: true},
        {id: 'component_type', label: 'Component Type', allowOrdering: true},
        {id: 'prefix', label: 'Prefix', allowOrdering: true},
        {id: 'seq_size', label: 'Sequence Size', allowOrdering: false},
        {id: 'next_seq', label: 'Next Sequence', allowOrdering: false},
        {}, // edit button
        // {}, // delete button
    ];

    // build the row content as an object map
    let tableRowContent = sequences.map(s => [
        s.name === editSeq ? (
            <TextField
                id="name"
                type="text"
                inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: { textAlign: 'left' },
                }}
                variant="standard"
                size="small"
                value={name}
                onChange={(e) => {
                    let val = e.target.value;
                    setNextSeq(val.replace(/[^0-9]*/g, ''));
                }}
                sx={{
                    maxWidth: 150,
                }}
            />
        ) : s.name,,
        s.name === editSeq ? (
            <Select
                id="componentType"
                variant="standard"
                size="small"
                value={componentType}
                onChange={(e) => {
                    setComponentType(e.target.value);
                }}
                sx={{
                    maxWidth: 100,
                }}
            >
                {Object.values(componentTypes).map((item) => {
                    return (
                        <MenuItem value={item.name}>
                            {item.name}
                        </MenuItem>
                    )
                })}
            </Select>
        ) : s.component_type.name,
        s.name === editSeq ? (
            <TextField
                id="prefix"
                type="text"
                inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: { textAlign: 'right' },
                }}
                variant="standard"
                size="small"
                value={prefix}
                onChange={(e) => {
                    let val = e.target.value;
                    setPrefix(val);
                }}
                sx={{
                    maxWidth: 80,
                }}
            />
        ) : s.prefix,
        s.name === editSeq ? (
            <TextField
                id="seqSize"
                type="text"
                inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: { textAlign: 'right' },
                }}
                variant="standard"
                size="small"
                value={seqSize}
                onChange={(e) => {
                    let val = e.target.value;
                    setSeqSize(val.replace(/[^0-9]*/g, ''));
                }}
                sx={{
                    maxWidth: 80,
                }}
            />
        ) : s.seq_size,
        s.name === editSeq ? (
            <TextField
                id="nextSeq"
                // label="Next Sequence"
                type="text"
                inputProps={{
                    inputMode: 'numeric',
                    pattern: '[0-9]*',
                    style: { textAlign: 'right' },
                }}
                variant="standard"
                size="small"
                value={nextSeq}
                onChange={(e) => {
                    let val = e.target.value;
                    setNextSeq(val.replace(/[^0-9]*/g, ''));
                }}
                sx={{
                    maxWidth: 80,
                }}
            />
        ) : s.next_seq,
        s.name === editSeq ? (
            <Button
                style={{
                    maxWidth: '40px',
                    maxHeight: '25px',
                    minWidth: '30px',
                    minHeight: '30px',
                    marginLeft: '10px'
                }}
                variant="outlined"
                onClick={handleSave}
            >
                <SaveIcon />
            </Button>
        ) : (
            <Button
                style={{
                    maxWidth: '40px',
                    maxHeight: '25px',
                    minWidth: '30px',
                    minHeight: '30px',
                    marginLeft:'10px'
                }}
                variant="outlined"
                onClick={() => handleEdit(s.name)}
            >
                <EditIcon />
            </Button>
        ),
    ]);

    return (
        <>
            <Authenticator />
            <ElementRangePanel
                min={min}
                updateMin={(n) => { setMin(n) }}
                range={range}
                updateRange={(n) => { setRange(n) }}
                count={count}
                width={"800px"}
                rightColumn={(
                    <ComponentSequenceAddButton
                        componentTypes={componentTypes}
                        toggleReload={toggleReload}
                    />
                )}
            />

            <ErrorMessage
                style={{ marginTop: '10px', marginBotton: '10px' }}
                errorMessage={errorData}
            />

            <ElementList
                tableRowContent={tableRowContent}
                loaded={loaded}
                orderBy={orderBy}
                direction={orderDirection}
                setOrderBy={setOrderBy}
                setOrderDirection={setOrderDirection}
                tableHeadCells={tableHeadCells}
                width={"800px"}
            />
        </>
    )
}

export default ComponentSequenceList;
