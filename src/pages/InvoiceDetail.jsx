import html2canvas from 'html2canvas';
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Divider,
    Button,
    Chip,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Alert,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Skeleton,
    SpeedDial,
    SpeedDialIcon,
    SpeedDialAction,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Switch,
    FormControlLabel,
} from '@mui/material';
import {
    Receipt as ReceiptIcon,
    Print as PrintIcon,
    Share as ShareIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Send as SendIcon,
    Download as DownloadIcon,
    Money as MoneyIcon,
    MoneyOff as MoneyOffIcon,
    ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { motion } from 'framer-motion';

import Layout from '../components/common/Layout';
// import DatabaseContext from '../contexts/DatabaseContext';
import apiClient from '../services/apiClient';
import UIContext from '../contexts/UIContext';
import { formatCurrency, formatDate } from '../utils/formatUtils';
import InvoicePDF from '../components/invoices/InvoicePDF';
import jsPDF from 'jspdf';

/**
 * InvoiceDetail page component
 * Displays detailed information about a specific invoice
 */
const InvoiceDetail = () => {
    // const { getInvoice, getInvoiceItems, updateInvoice, deleteInvoice } = useContext(DatabaseContext);
    const { showSnackbar, showDeleteDialog, setLoading } = useContext(UIContext);
    const navigate = useNavigate();
    const { id } = useParams();

    // State
    const [invoice, setInvoice] = useState(null);
    const [invoiceItems, setInvoiceItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isPaidDialogOpen, setIsPaidDialogOpen] = useState(false);
    const [isPaid, setIsPaid] = useState(false);

    // Refs
    const invoiceRef = useRef();

    // Load invoice data
    useEffect(() => {
        const loadInvoice = async () => {
            try {
                setIsLoading(true);
                setError(null);

                // Get invoice data
                // const invoiceData = await getInvoice(parseInt(id));
                const invoiceData = await apiClient.byIdLocalInvoice(id);

                if (!invoiceData) {
                    setError('Invoice not found');
                    return;
                }

                setInvoice(invoiceData);
                setIsPaid(invoiceData?.status === 'paid');

                // Get invoice items
                // const items = await getInvoiceItems(invoiceData.id);
                const items = invoiceData.items || [];
                setInvoiceItems(items);
            } catch (error) {
                console.error('Error loading invoice:', error);
                setError('Failed to load invoice');
            } finally {
                setIsLoading(false);
            }
        };

        if (id) {
            loadInvoice();
        }
    }, [id]);

    // Handle invoice actions
    const handlePrint = () => {
        if (invoiceRef.current) {
            const printContent = invoiceRef.current.innerHTML;
            const printWindow = window.open('', '', 'width=800,height=600');

            printWindow.document.write(`
              <html>
                <head>
                  <title>Invoice #${invoice.order_id}</title>
                  <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f2f2f2; }
                    .header { margin-bottom: 20px; }
                    .footer { margin-top: 30px; }
                    .total { font-weight: bold; font-size: 16px; margin-top: 20px; }
                    .status { padding: 5px 10px; border-radius: 4px; display: inline-block; }
                    .paid { background-color: #e6f7e6; color: #2e7d32; }
                    .unpaid { background-color: #fdecea; color: #d32f2f; }
                    @media print { button { display: none; } }
                  </style>
                </head>
                <body>
                  ${printContent}
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
    };

    // Toggle payment status dialog
    const openPaidDialog = () => {
        setIsPaidDialogOpen(true);
    };

    const closePaidDialog = () => {
        setIsPaidDialogOpen(false);
    };

    // Update payment status
    const updatePaymentStatus = async () => {
        try {
            setLoading(true);

            await apiClient.uprateLocalInvoiceStatus(invoice.order_id, isPaid ? 'paid' : 'unpaid');

            showSnackbar(`Invoice marked as ${isPaid ? 'paid' : 'unpaid'}`, 'success');
            closePaidDialog();
        } catch (error) {
            console.error('Error updating payment status:', error);
            showSnackbar('Failed to update payment status', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Handle delete invoice
    const handleDelete = () => {
        showDeleteDialog(
            'Delete Invoice',
            `Are you sure you want to delete Invoice #${invoice.order_id}? This action cannot be undone.`,
            async () => {
                try {
                    setLoading(true);

                    await apiClient.deleteLocalInvoice(invoice.order_id);

                    showSnackbar('Invoice deleted successfully', 'success');
                    navigate('/invoices');
                } catch (error) {
                    console.error('Error deleting invoice:', error);
                    showSnackbar('Failed to delete invoice', 'error');
                } finally {
                    setLoading(false);
                }
            }
        );
    };

    // Calculate totals
    const calculateSubtotal = () => {
        return invoiceItems.reduce((sum, item) => sum + item.total, 0);
    };

    // SpeedDial actions
    const actions = [
        { icon: <PrintIcon />, name: 'Print', action: handlePrint },
        {
            icon: <DownloadIcon />,
            name: 'Download PDF',
            action: () => {
                if (invoiceRef.current) {
                    // Используем html2canvas для создания canvas из содержимого элемента
                    html2canvas(invoiceRef.current).then((canvas) => {
                        // Преобразуем canvas в изображение в формате PNG
                        const imgData = canvas.toDataURL('image/png');

                        // Создаём новый PDF-документ формата A4
                        const pdf = new jsPDF('p', 'mm', 'a4');

                        // Определяем размеры страницы PDF
                        const pdfWidth = pdf.internal.pageSize.getWidth();
                        const pdfHeight = pdf.internal.pageSize.getHeight();

                        // Получаем исходные размеры canvas
                        const imgWidth = canvas.width;
                        const imgHeight = canvas.height;

                        // Вычисляем пропорциональные размеры изображения для встраивания в PDF
                        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
                        const imgScaledWidth = imgWidth * ratio;
                        const imgScaledHeight = imgHeight * ratio;

                        // Центрирование изображения на странице
                        const x = (pdfWidth - imgScaledWidth) / 2;
                        const y = (pdfHeight - imgScaledHeight) / 2;

                        // Добавляем изображение в PDF
                        pdf.addImage(imgData, 'PNG', x, y, imgScaledWidth, imgScaledHeight);

                        // Сохраняем PDF-файл с именем, содержащим номер счета
                        pdf.save(`Invoice_${invoice.order_id}.pdf`);
                    });
                }
            },
        },
        // { icon: <EditIcon />, name: 'Edit', action: () => navigate(`/invoice/${id}/edit`) },
        { icon: <DeleteIcon />, name: 'Delete', action: handleDelete },
        {
            icon: invoice?.status === 'paid' ? <MoneyOffIcon /> : <MoneyIcon />,
            name: 'Toggle Payment',
            action: openPaidDialog,
        },
    ];

    // Render loading state
    if (isLoading) {
        return (
            <Layout title="Invoice Details" showBackButton>
                <Paper elevation={2} sx={{ p: 3, mb: 2 }}>
                    <Skeleton variant="text" width="50%" height={40} sx={{ mb: 2 }} />
                    <Skeleton variant="text" width="30%" height={30} sx={{ mb: 1 }} />
                    <Skeleton variant="text" width="20%" height={30} sx={{ mb: 3 }} />

                    <Divider sx={{ my: 3 }} />

                    <Skeleton variant="rectangular" height={200} sx={{ mb: 3 }} />

                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="text" width="80%" height={30} />
                            <Skeleton variant="text" width="60%" height={30} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="text" width="80%" height={30} sx={{ ml: 'auto' }} />
                            <Skeleton variant="text" width="60%" height={30} sx={{ ml: 'auto' }} />
                        </Grid>
                    </Grid>
                </Paper>
            </Layout>
        );
    }

    // Render error state
    if (error) {
        return (
            <Layout title="Error" showBackButton>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Alert
                        severity="error"
                        action={
                            <Button color="inherit" size="small" onClick={() => navigate('/invoices')}>
                                Back to Invoices
                            </Button>
                        }
                        sx={{ mb: 2 }}
                    >
                        {error}
                    </Alert>

                    <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
                        <ReceiptIcon sx={{ fontSize: 64, color: 'text.secondary', my: 2 }} />
                        <Typography variant="h5" gutterBottom>
                            Invoice not found
                        </Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            The invoice you're looking for doesn't exist or has been deleted.
                        </Typography>
                        <Button
                            variant="contained"
                            startIcon={<ArrowBackIcon />}
                            onClick={() => navigate('/invoices')}
                            sx={{ mt: 2 }}
                        >
                            Return to Invoices
                        </Button>
                    </Paper>
                </motion.div>
            </Layout>
        );
    }

    return (
        <Layout title={`Invoice #${invoice.order_id}`} showBackButton>
            <Box sx={{ position: 'relative', pb: 8 }}>
                {/* Invoice Content */}
                <Paper
                    elevation={2}
                    component={motion.div}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    sx={{ p: 3, mb: 2 }}
                    ref={invoiceRef}
                >
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            justifyContent: 'space-between',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            mb: 3,
                        }}
                    >
                        <Box>
                            <Typography variant="h5" component="h1" gutterBottom>
                                Invoice #{invoice.order_id}
                            </Typography>

                            <Typography variant="body1" color="text.secondary">
                                Date: {formatDate(invoice.created_at, 'datetime')}
                            </Typography>
                        </Box>

                        <Chip
                            label={invoice.status !== 'unpaid' ? 'PAID' : 'UNPAID'}
                            color={invoice.status !== 'unpaid' ? 'success' : 'error'}
                            size="medium"
                            sx={{
                                fontSize: '1rem',
                                fontWeight: 'bold',
                                py: 1,
                                mt: { xs: 2, sm: 0 },
                            }}
                        />
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Invoice Items */}
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Product</TableCell>
                                    <TableCell align="center">Quantity</TableCell>
                                    <TableCell align="right">Price</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {invoiceItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Typography variant="body1">{item.sku_name}</Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {item.barcode}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">{item.quantity}</TableCell>
                                        <TableCell align="right">{formatCurrency(item.price)}</TableCell>
                                        <TableCell align="right">{formatCurrency(item.total)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Invoice Summary */}
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            mb: 3,
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                width: { xs: '100%', sm: '300px' },
                                mb: 1,
                            }}
                        >
                            <Typography variant="body1">Subtotal:</Typography>
                            <Typography variant="body1">{formatCurrency(calculateSubtotal())}</Typography>
                        </Box>

                        <Divider sx={{ width: { xs: '100%', sm: '300px' }, my: 1 }} />

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                width: { xs: '100%', sm: '300px' },
                                mb: 1,
                            }}
                        >
                            <Typography variant="h6" fontWeight="bold">
                                Total:
                            </Typography>
                            <Typography variant="h6" fontWeight="bold" color="primary.main">
                                {formatCurrency(invoice.total_amount)}
                            </Typography>
                        </Box>
                    </Box>

                    {/* Additional Info */}
                    <Box sx={{ mt: 4 }}>
                        <Typography variant="body2" color="text.secondary" align="center">
                            Thank you for your business!
                        </Typography>
                    </Box>
                </Paper>

                {/* Payment Status Dialog */}
                <Dialog open={isPaidDialogOpen} onClose={closePaidDialog}>
                    <DialogTitle>Update Payment Status</DialogTitle>
                    <DialogContent>
                        <Box sx={{ p: 2 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={isPaid}
                                        onChange={(e) => setIsPaid(e.target.checked)}
                                        color={isPaid ? 'success' : 'error'}
                                    />
                                }
                                label={isPaid ? 'Paid' : 'Unpaid'}
                            />

                            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                                {isPaid
                                    ? 'Mark this invoice as paid. This indicates that payment has been received.'
                                    : 'Mark this invoice as unpaid. This indicates that payment is still pending.'}
                            </Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={closePaidDialog}>Cancel</Button>
                        <Button onClick={updatePaymentStatus} variant="contained" color={isPaid ? 'success' : 'error'}>
                            {isPaid ? 'Mark as Paid' : 'Mark as Unpaid'}
                        </Button>
                    </DialogActions>
                </Dialog>

                {/* Speed Dial Actions */}
                <SpeedDial
                    ariaLabel="invoice actions"
                    sx={{ position: 'fixed', bottom: 16, right: 16 }}
                    icon={<SpeedDialIcon />}
                >
                    {actions.map((action) => (
                        <SpeedDialAction
                            key={action.name}
                            icon={action.icon}
                            tooltipTitle={action.name}
                            onClick={action.action}
                        />
                    ))}
                </SpeedDial>
            </Box>
        </Layout>
    );
};

export default InvoiceDetail;
