import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    TextField,
    Typography,
    Button,
    InputAdornment,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Chip,
    Divider,
    CircularProgress,
    Stack,
    Menu,
    MenuItem,
    ListItemIcon,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    Delete as DeleteIcon,
    Print as PrintIcon,
    Edit as EditIcon,
    FilterList as FilterListIcon,
    Receipt as ReceiptIcon,
} from '@mui/icons-material';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';

import Layout from '../components/common/Layout';
// import DatabaseContext from '../contexts/DatabaseContext';
import apiClient from '../services/apiClient';
import UIContext from '../contexts/UIContext';
import { formatCurrency, formatDate } from '../utils/formatUtils';

/**
 * InvoiceHistory page component
 * Displays list of invoices with filtering and search
 */
const InvoiceHistory = () => {
    // const { getInvoicesByPeriod, deleteInvoice } = useContext(DatabaseContext);
    const { showSnackbar, showDeleteDialog, setLoading } = useContext(UIContext);
    const navigate = useNavigate();

    // State
    const [invoices, setInvoices] = useState([]);
    const [filteredInvoices, setFilteredInvoices] = useState([]);
    const [startDate, setStartDate] = useState(dayjs().startOf('month')); // First day of current month
    const [endDate, setEndDate] = useState(dayjs()); // Today
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState('all');

    // Menu state
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Load invoices based on date range
    useEffect(() => {
        loadInvoices();
    }, [startDate, endDate]);

    // Load invoices from database
    const loadInvoices = async () => {
        try {
            setIsLoading(true);

            // Format dates for database query
            const startDateFormatted = startDate.startOf('day').toISOString().split('.')[0];
            const endDateFormatted = endDate.endOf('day').toISOString().split('.')[0];

            // Get invoices from database
            // const invoiceList = await getInvoicesByPeriod(startDateFormatted, endDateFormatted);
            const invoiceList = await apiClient.getLocalInvoicesByPeriod(startDateFormatted, endDateFormatted);
            setInvoices(invoiceList);

            // Apply filters
            filterInvoices(invoiceList, searchTerm, selectedStatus);
        } catch (error) {
            console.error('Error loading invoices:', error);
            showSnackbar('Error loading invoices', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    // Filter invoices based on search term and status
    const filterInvoices = (invoiceList, search, status) => {
        let filtered = [...invoiceList];

        // Filter by search term
        if (search) {
            filtered = filtered.filter((invoice) => invoice.order_id.toString().includes(search));
        }

        // Filter by status
        if (status !== 'all') {
            const isPaid = status === 'paid';

            filtered = filtered.filter((invoice) => {
                if (isPaid) {
                    return invoice.status === 'paid';
                } else {
                    return invoice.status === 'unpaid';
                }
            });
        }

        setFilteredInvoices(filtered);
    };

    // Handle search
    const handleSearch = () => {
        filterInvoices(invoices, searchTerm, selectedStatus);
    };

    // Clear search
    const clearSearch = () => {
        setSearchTerm('');
        filterInvoices(invoices, '', selectedStatus);
    };

    // Handle status filter change
    const handleStatusChange = (status) => {
        setSelectedStatus(status);
        filterInvoices(invoices, searchTerm, status);
    };

    // Invoice menu functions
    const openMenu = (event, invoice) => {
        setMenuAnchorEl(event.currentTarget);
        setSelectedInvoice(invoice);
    };

    const closeMenu = () => {
        setMenuAnchorEl(null);
    };

    // Handle invoice actions
    const viewInvoice = (invoice) => {
        closeMenu();
        navigate(`/invoice/${invoice.order_id}`);
    };

    const editInvoice = (invoice) => {
        closeMenu();
        // navigate(`/invoice/${invoice.order_id}/edit`);
    };

    const printInvoice = (invoice) => {
        if (invoice) {
            const printWindow = window.open('', '', 'width=800,height=600');

            printWindow.document.write(`
                <html>
            <head>
        <title>
            Invoice #${invoice.order_id}
        </title>
        <style>
            body {
              font-family: Arial,sans-serif;
              padding: 20px;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            
            th,td {
              padding: 8px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            
            th {
              background-color: #f2f2f2;
            }
            
            .header {
              margin-bottom: 20px;
            }
            
            .footer {
              margin-top: 30px;
            }
            
            .total {
              font-weight: bold;
              font-size: 16px;
              margin-top: 20px;
            }
            
            .status {
              padding: 5px 10px;
              border-radius: 4px;
              display: inline-block;
            }
            
            .paid {
              background-color: #e6f7e6;
              color: #2e7d32;
            }
            
            .unpaid {
              background-color: #fdecea;
              color: #d32f2f;
            }
            
            @media print {
              button {
                display: none;
              }
            
            }
        </style>
    </head>
    <body>
        <div class="MuiBox-root css-1hpa69f">
            <div class="MuiBox-root css-0">
                <h1 class="MuiTypography-root MuiTypography-h5 MuiTypography-gutterBottom css-5kjxxr-MuiTypography-root">
                    Invoice #${invoice.order_id}
                </h1>
                <p class="MuiTypography-root MuiTypography-body1 css-k0v82y-MuiTypography-root">
                    Date: ${invoice.created_at}
                </p>
            </div>
            <div class="MuiChip-root MuiChip-filled MuiChip-sizeMedium MuiChip-colorError MuiChip-filledError css-55zt6e-MuiChip-root">
                <span class="MuiChip-label MuiChip-labelMedium css-6od3lo-MuiChip-label">
                    UNPAID: ${invoice.updated_at}
                </span>
            </div>
        </div>
        <hr class="MuiDivider-root MuiDivider-fullWidth css-1iknwlx-MuiDivider-root">
        <div class="MuiPaper-root MuiPaper-outlined MuiPaper-rounded MuiTableContainer-root css-7t5xwb-MuiPaper-root-MuiTableContainer-root">
            <table class="MuiTable-root css-1nlai5s-MuiTable-root">
                <thead class="MuiTableHead-root css-15wwp11-MuiTableHead-root">
                    <tr class="MuiTableRow-root MuiTableRow-head css-zjxnjz-MuiTableRow-root">
                        <th class="MuiTableCell-root MuiTableCell-head MuiTableCell-sizeMedium css-3j5v83-MuiTableCell-root" scope="col">
                            Product
                        </th>
                        <th class="MuiTableCell-root MuiTableCell-head MuiTableCell-alignCenter MuiTableCell-sizeMedium css-1i6khf7-MuiTableCell-root" scope="col">
                            Quantity
                        </th>
                        <th class="MuiTableCell-root MuiTableCell-head MuiTableCell-alignRight MuiTableCell-sizeMedium css-1li21ik-MuiTableCell-root" scope="col">
                            Price
                        </th>
                        <th class="MuiTableCell-root MuiTableCell-head MuiTableCell-alignRight MuiTableCell-sizeMedium css-1li21ik-MuiTableCell-root" scope="col">
                            Total
                        </th>
                    </tr>
                </thead>
                <tbody class="MuiTableBody-root css-apqrd9-MuiTableBody-root">
                    ${(invoice.items ?? []).map(
                        (item) => `<tr class="MuiTableRow-root css-zjxnjz-MuiTableRow-root">
                        <td class="MuiTableCell-root MuiTableCell-body MuiTableCell-sizeMedium css-wpnn0d-MuiTableCell-root">
                            <p class="MuiTypography-root MuiTypography-body1 css-1y59pf2-MuiTypography-root">
                                ${item?.sku_name}
                            </p>
                            <span class="MuiTypography-root MuiTypography-caption css-1cz0maw-MuiTypography-root">
                            </span>
                        </td>
                        <td class="MuiTableCell-root MuiTableCell-body MuiTableCell-alignCenter MuiTableCell-sizeMedium css-447bl9-MuiTableCell-root">
                            ${item?.quantity ?? 0}
                        </td>
                        <td class="MuiTableCell-root MuiTableCell-body MuiTableCell-alignRight MuiTableCell-sizeMedium css-1xjm43n-MuiTableCell-root">
                            ${formatCurrency(item?.price ?? 0)}
                        </td>
                        <td class="MuiTableCell-root MuiTableCell-body MuiTableCell-alignRight MuiTableCell-sizeMedium css-1xjm43n-MuiTableCell-root">
                            ${formatCurrency(item?.total ?? 0)}
                        </td>
                    </tr>`
                    )}
                </tbody>
            </table>
        </div>
        <div class="MuiBox-root css-bn3a8e">
            ${(invoice.items ?? []).map(
                (item) => `<div class="MuiBox-root css-18goe8w">
                <p class="MuiTypography-root MuiTypography-body1 css-1y59pf2-MuiTypography-root">
                    Subtotal:
                </p>
                <p class="MuiTypography-root MuiTypography-body1 css-1y59pf2-MuiTypography-root">
                    ${formatCurrency(item?.total ?? 0)}
                </p>
            </div>
            <hr class="MuiDivider-root MuiDivider-fullWidth css-1r007c9-MuiDivider-root">`
            )}
            <div class="MuiBox-root css-18goe8w">
                <h6 class="MuiTypography-root MuiTypography-h6 css-h8lkug-MuiTypography-root">
                    Total:
                </h6>
                <h6 class="MuiTypography-root MuiTypography-h6 css-spillb-MuiTypography-root">
                    ${formatCurrency(invoice?.total_amount ?? 0)}
                </h6>
            </div>
        </div>
        <div class="MuiBox-root css-h5fkc8">
            <p class="MuiTypography-root MuiTypography-body2 MuiTypography-alignCenter css-1dy20js-MuiTypography-root">
                Thank you for your business!
            </p>
        </div>
    </body>
</html>
`);

            printWindow.document.close();
            printWindow.focus();

            // Закрываем окно после завершения печати
            printWindow.addEventListener('cancel', function () {
                printWindow.close();
            });
            // Закрываем окно после завершения печати
            printWindow.addEventListener('afterprint', function () {
                printWindow.close();
            });

            printWindow.print();
        }
        closeMenu();
    };

    const handleDeleteInvoice = (invoice) => {
        closeMenu();

        showDeleteDialog(
            'Delete Invoice',
            `Are you sure you want to delete invoice #${invoice.id}? This action cannot be undone.`,
            async () => {
                try {
                    setLoading(true);

                    // await deleteInvoice(invoice.id);
                    await apiClient.deleteLocalInvoice(invoice.order_id);

                    showSnackbar('Invoice deleted successfully', 'success');

                    // Refresh invoice list
                    loadInvoices();
                } catch (error) {
                    console.error('Error deleting invoice:', error);
                    showSnackbar('Failed to delete invoice', 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
    };

    // Container animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05,
            },
        },
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { duration: 0.3 },
        },
        exit: {
            y: -20,
            opacity: 0,
            transition: { duration: 0.2 },
        },
    };

    return (
        <Layout title="Invoice History">
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Search bar */}
                <Paper
                    elevation={2}
                    component={motion.div}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    sx={{ p: 2, mb: 2 }}
                >
                    <TextField
                        fullWidth
                        variant="outlined"
                        placeholder="Search by invoice number"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                                handleSearch();
                            }
                        }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon color="action" />
                                </InputAdornment>
                            ),
                            endAdornment: searchTerm && (
                                <InputAdornment position="end">
                                    <IconButton edge="end" onClick={clearSearch} size="small">
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                        size="small"
                        sx={{ mb: 2 }}
                    />

                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            gap: 2,
                            alignItems: { xs: 'stretch', sm: 'center' },
                        }}
                    >
                        {/* Date range pickers */}
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexGrow: 1 }}>
                            <DatePicker
                                label="From Date"
                                value={startDate}
                                onChange={(newValue) => setStartDate(newValue)}
                                slotProps={{
                                    textField: {
                                        size: 'small',
                                        fullWidth: true,
                                    },
                                }}
                            />

                            <DatePicker
                                label="To Date"
                                value={endDate}
                                onChange={(newValue) => setEndDate(newValue)}
                                slotProps={{
                                    textField: {
                                        size: 'small',
                                        fullWidth: true,
                                    },
                                }}
                            />
                        </Stack>

                        {/* Status filter */}
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant={selectedStatus === 'all' ? 'contained' : 'outlined'}
                                size="small"
                                onClick={() => handleStatusChange('all')}
                            >
                                All
                            </Button>

                            <Button
                                variant={selectedStatus === 'paid' ? 'contained' : 'outlined'}
                                size="small"
                                color="success"
                                onClick={() => handleStatusChange('paid')}
                            >
                                Paid
                            </Button>

                            <Button
                                variant={selectedStatus === 'unpaid' ? 'contained' : 'outlined'}
                                size="small"
                                color="error"
                                onClick={() => handleStatusChange('unpaid')}
                            >
                                Unpaid
                            </Button>
                        </Box>
                    </Box>
                </Paper>

                {/* Invoice list */}
                <Paper
                    elevation={2}
                    component={motion.div}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}
                >
                    <Box
                        sx={{
                            p: 2,
                            borderBottom: 1,
                            borderColor: 'divider',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}
                    >
                        <Typography variant="h6" component="h2">
                            Invoices
                        </Typography>

                        <Chip
                            icon={<FilterListIcon />}
                            label={`${filteredInvoices.length} ${
                                filteredInvoices.length === 1 ? 'invoice' : 'invoices'
                            }`}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                    </Box>

                    {isLoading ? (
                        <Box
                            sx={{
                                flexGrow: 1,
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                p: 4,
                            }}
                        >
                            <CircularProgress />
                        </Box>
                    ) : filteredInvoices.length === 0 ? (
                        <Box
                            sx={{
                                flexGrow: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                p: 4,
                            }}
                        >
                            <ReceiptIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="body1" color="text.secondary" gutterBottom>
                                {searchTerm ? 'No invoices match your search' : 'No invoices found for this period'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {searchTerm
                                    ? 'Try a different search term or date range'
                                    : 'Try selecting a different date range'}
                            </Typography>
                        </Box>
                    ) : (
                        <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
                            <AnimatePresence>
                                <motion.div variants={containerVariants} initial="hidden" animate="visible">
                                    {filteredInvoices.map((invoice) => (
                                        <motion.div key={invoice.id} variants={itemVariants}>
                                            <ListItem
                                                divider
                                                sx={{
                                                    py: 2,
                                                    borderLeft: 4,
                                                    borderLeftColor:
                                                        invoice.status === 'paid' ? 'success.main' : 'error.main',
                                                    '&:hover': {
                                                        bgcolor: 'action.hover',
                                                    },
                                                }}
                                                secondaryAction={
                                                    <IconButton edge="end" onClick={(e) => openMenu(e, invoice)}>
                                                        <MoreVertIcon />
                                                    </IconButton>
                                                }
                                            >
                                                <ListItemText
                                                    primary={
                                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                            <Typography
                                                                variant="subtitle1"
                                                                component="span"
                                                                fontWeight="medium"
                                                            >
                                                                Invoice #{invoice.order_id}
                                                            </Typography>
                                                            <Chip
                                                                label={invoice.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                size="small"
                                                                color={invoice.status === 'paid' ? 'success' : 'error'}
                                                                sx={{ ml: 1 }}
                                                            />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Box sx={{ mt: 0.5 }}>
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                                component="span"
                                                            >
                                                                Date: {formatDate(invoice.date, 'datetime')}
                                                            </Typography>
                                                            <Typography
                                                                variant="body2"
                                                                component="div"
                                                                fontWeight="bold"
                                                                color="primary.main"
                                                                sx={{ mt: 0.5 }}
                                                            >
                                                                Total: {formatCurrency(invoice.total_amount)}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    onClick={() => viewInvoice(invoice)}
                                                    sx={{ cursor: 'pointer' }}
                                                />
                                            </ListItem>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </AnimatePresence>
                        </List>
                    )}
                </Paper>

                {/* Invoice actions menu */}
                <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={closeMenu}
                    PaperProps={{
                        elevation: 3,
                        sx: { width: 200, maxWidth: '100%' },
                    }}
                >
                    <MenuItem onClick={() => selectedInvoice && viewInvoice(selectedInvoice)}>
                        <ListItemIcon>
                            <VisibilityIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>View</ListItemText>
                    </MenuItem>

                    {/* <MenuItem onClick={() => selectedInvoice && editInvoice(selectedInvoice)}>
                        <ListItemIcon>
                            <EditIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Edit</ListItemText>
                    </MenuItem> */}

                    <MenuItem onClick={() => selectedInvoice && printInvoice(selectedInvoice)}>
                        <ListItemIcon>
                            <PrintIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Print</ListItemText>
                    </MenuItem>

                    <Divider />

                    <MenuItem
                        onClick={() => selectedInvoice && handleDeleteInvoice(selectedInvoice)}
                        sx={{ color: 'error.main' }}
                    >
                        <ListItemIcon sx={{ color: 'error.main' }}>
                            <DeleteIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Delete</ListItemText>
                    </MenuItem>
                </Menu>
            </Box>
        </Layout>
    );
};

export default InvoiceHistory;
