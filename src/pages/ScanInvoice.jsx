import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    TextField,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemText,
    Typography,
    Divider,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
    CircularProgress,
    Card,
    ButtonGroup,
    Collapse,
    Fab,
    Zoom,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material';
import {
    QrCodeScanner as ScannerIcon,
    Search as SearchIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Save as SaveIcon,
    PhotoCamera as CameraIcon,
    Close as CloseIcon,
    Edit as EditIcon,
    AddCircle as AddCircleIcon,
    RemoveCircle as RemoveCircleIcon,
} from '@mui/icons-material';
import Webcam from 'react-webcam';
import { motion } from 'framer-motion';

import Layout from '../components/common/Layout';
// import DatabaseContext from '../contexts/DatabaseContext';
import UIContext from '../contexts/UIContext';
import barcodeService from '../services/barcodeService';
import apiClient from '../services/apiClient';
import { formatCurrency } from '../utils/formatUtils';

/**
 * ScanInvoice page component
 * Handles barcode scanning and invoice creation
 */
const ScanInvoice = () => {
    // const { addProduct, findProductByBarcode, findProductById, updateProductQuantity, createInvoice, addInvoiceItem } =
    //     useContext(DatabaseContext);
    const { showSnackbar, showDialog, hideDialog, setLoading } = useContext(UIContext);
    const navigate = useNavigate();

    // State for camera and scanning
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraDevices, setCameraDevices] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState(null);
    const webcamRef = useRef(null);

    // State for invoice
    const [barcodeInput, setBarcodeInput] = useState('');
    const [invoiceItems, setInvoiceItems] = useState([]);

    const [isPaid, setIsPaid] = useState(true);

    const [editItem, setEditItem] = useState(null);
    const [editIndex, setEditIndex] = useState(-1);
    const [editQuantity, setEditQuantity] = useState(1);
    const [editPrice, setEditPrice] = useState(0);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Initialize barcode scanner
    useEffect(() => {
        const initializeScanner = async () => {
            try {
                await barcodeService.initialize();

                // Get available cameras
                const cameras = await barcodeService.getCameras();
                setCameraDevices(cameras);

                // Select the environment-facing camera by default if available
                const envCamera = cameras.find(
                    (camera) =>
                        camera.label.toLowerCase().includes('back') ||
                        camera.label.toLowerCase().includes('environment')
                );

                if (envCamera) {
                    setSelectedCamera(envCamera.deviceId);
                } else if (cameras.length > 0) {
                    setSelectedCamera(cameras[0].deviceId);
                }
            } catch (error) {
                console.error('Error initializing scanner:', error);
                showSnackbar('Error initializing camera. Please check permissions.', 'error');
            }
        };

        initializeScanner();

        // Cleanup on unmount
        return () => {
            barcodeService.stopScanning();
        };
    }, [showSnackbar]);

    // Calculate total
    const calculateTotal = () => {
        return invoiceItems.reduce((sum, item) => sum + item.total, 0);
    };

    // Handle barcode scanning
    const handleBarcodeScan = async (barcode) => {
        if (isProcessing) return;

        try {
            setIsProcessing(true);
            setBarcodeInput(barcode);

            // Process the barcode
            await processBarcode(barcode);
        } finally {
            setIsProcessing(false);
        }
    };

    // Process barcode input
    const processBarcode = async (barcode) => {
        if (!barcode) {
            showSnackbar('Please enter a barcode', 'warning');
            return;
        }

        try {
            setLoading(true);

            // Check cloud database
            const cloudProduct = await apiClient.getProduct(barcode);

            if (cloudProduct) {
                // Save the product to local database and add to invoice
                handleCloudProduct(cloudProduct);
            } else {
                // Show create product dialog
                showCreateProductDialog(barcode);
            }
        } catch (error) {
            console.error('Error processing barcode:', error);
            showSnackbar('Error processing barcode. Please try again.', 'error');
        } finally {
            setBarcodeInput('');
            setLoading(false);
        }
    };

    // Handle product with no price
    const handleProductWithoutPrice = (product) => {
        showDialog(
            'Product has no price',
            `The product "${product.sku_name}" has no price. Do you want to update it?`,
            [
                {
                    text: 'Later',
                    color: 'inherit',
                    variant: 'outlined',
                    handler: () => hideDialog(),
                },
                {
                    text: 'Update Now',
                    color: 'primary',
                    variant: 'contained',
                    handler: () => {
                        hideDialog();
                        navigate(`/product/${product.id}`);
                    },
                },
            ]
        );
    };

    // Handle cloud product
    const handleCloudProduct = async (cloudProduct) => {
        // Save to local database
        const productData = {
            ...cloudProduct,
            quantity: 0,
            cost_price: 0,
            price: 0,
        };
        const localProductsList = await apiClient.searchLocalProducts(cloudProduct.barcode);
        const localProduct = localProductsList.find((product) => product.barcode === cloudProduct.barcode);
        try {
            if (!localProduct) {
                // const productId = await addProduct(productData);
                const productId = await apiClient.addLocalProduct(productData);
                if (productId) {
                    // const newProduct = await findProductById(productId);
                    const newProduct = await apiClient.byIdLocalProduct(productId);
                    if (newProduct && newProduct.price === 0) {
                        // Show price dialog
                        handleProductWithoutPrice(newProduct);
                    }
                    // Add to invoice
                    addProductToInvoice(newProduct);
                }
            } else {
                if (localProduct.price === 0) {
                    // Show price dialog
                    handleProductWithoutPrice(localProduct);
                }

                // Add to invoice
                addProductToInvoice(localProduct);
            }
        } catch (error) {
            console.error('Error adding cloud product:', error);
            showSnackbar('Error adding product from cloud.', 'error');
        }
    };

    // Show create product dialog
    const showCreateProductDialog = (barcode) => {
        showDialog('Product Not Found', 'This product does not exist in the database. Would you like to create it?', [
            {
                text: 'Cancel',
                color: 'inherit',
                variant: 'outlined',
                handler: () => hideDialog(),
            },
            {
                text: 'Create Product',
                color: 'primary',
                variant: 'contained',
                handler: () => {
                    hideDialog();
                    navigate(`/product/create?barcode=${barcode}`);
                },
            },
        ]);
    };

    // Add product to invoice
    const addProductToInvoice = (product) => {
        console.log('🚀 ~ addProductToInvoice ~ product:', product);
        const item = {
            productId: product.id,
            barcode: product.barcode,
            sku_name: product.sku_name,
            price: product.price,
            cost_price: product.cost_price,
            quantity: 1,
            total: product.price,
        };

        // Check if product already exists in invoice
        const existingIndex = invoiceItems.findIndex((existingItem) => existingItem.barcode === item.barcode);

        if (existingIndex !== -1) {
            // Update existing item
            setInvoiceItems((prevItems) => {
                const updatedItems = [...prevItems];
                updatedItems[existingIndex].quantity += 1;
                updatedItems[existingIndex].total =
                    updatedItems[existingIndex].quantity * updatedItems[existingIndex].price;
                return updatedItems;
            });
            showSnackbar(`Added: ${product.sku_name}`, 'success');
        } else {
            // Add new item
            setInvoiceItems((prevItems) => [...prevItems, item]);
            showSnackbar(`Added: ${product.sku_name}`, 'success');
        }
    };

    // Toggle camera
    const toggleCamera = async () => {
        if (isCameraOpen) {
            // Stop scanning
            barcodeService.stopScanning();
            setIsCameraOpen(false);
        } else {
            setIsCameraOpen(true);
        }
    };

    // Start scanning when camera is opened
    useEffect(() => {
        if (isCameraOpen && webcamRef.current && selectedCamera) {
            // Start scanning with a short delay to ensure camera is initialized
            const timer = setTimeout(() => {
                try {
                    barcodeService.startScanning(webcamRef.current.video, handleBarcodeScan, selectedCamera);
                } catch (error) {}
            }, 1200);

            return () => clearTimeout(timer);
        }
    }, [isCameraOpen, selectedCamera]);

    // Open edit dialog for item
    const openEditDialog = (item, index) => {
        setEditItem(item);
        setEditIndex(index);
        setEditQuantity(item.quantity);
        setEditPrice(item.price);
        setIsEditDialogOpen(true);
    };

    // Close edit dialog
    const closeEditDialog = () => {
        setEditItem(null);
        setEditIndex(-1);
        setIsEditDialogOpen(false);
    };

    // Save edited item
    const saveEditedItem = () => {
        if (editIndex >= 0 && editItem) {
            setInvoiceItems((prevItems) => {
                const updatedItems = [...prevItems];
                updatedItems[editIndex] = {
                    ...editItem,
                    quantity: editQuantity,
                    price: editPrice,
                    total: editQuantity * editPrice,
                };
                return updatedItems;
            });
            closeEditDialog();
            showSnackbar('Item updated', 'success');
        }
    };

    // Remove item from invoice
    const removeItem = (index) => {
        setInvoiceItems((prevItems) => {
            const updatedItems = [...prevItems];
            updatedItems.splice(index, 1);
            return updatedItems;
        });

        if (isEditDialogOpen) {
            closeEditDialog();
        }

        showSnackbar('Item removed from invoice', 'success');
    };

    // Save invoice
    const saveInvoice = async () => {
        if (invoiceItems.length === 0) {
            showSnackbar('Cannot save empty invoice', 'warning');
            return;
        }
        setLoading(true);

        // Create invoice
        const newInvoice = (Array.isArray(invoiceItems) ? invoiceItems : []).map((item) => ({
            product_id: item.id || item.productId,
            quantity: item.quantity,
            price: item.price,
            cost_price: item.cost_price,
        }));

        try {
            const invoiceId = await apiClient.createLocalInvoice(newInvoice, isPaid ? 'paid' : 'unpaid');

            // Clear invoice
            setInvoiceItems([]);

            // Show success message
            showSnackbar(`Invoice #${invoiceId} saved successfully`, 'success');

            // Navigate to invoice detail
            navigate(`/invoice/${invoiceId}`);
        } catch (error) {
            console.error('Error saving invoice:', error);
            showSnackbar('Error saving invoice. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Toggle payment status
    const togglePaymentStatus = () => {
        setIsPaid(!isPaid);
    };

    return (
        <Layout title="Scan Invoice" showBackButton rightIcon={<CameraIcon />} rightIconAction={toggleCamera}>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Barcode input section */}
                <Paper
                    elevation={2}
                    component={motion.div}
                    initial={{ y: -20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    sx={{ p: 2, mb: 2 }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            label="Enter Barcode"
                            value={barcodeInput}
                            onChange={(e) => setBarcodeInput(e.target.value?.trim())}
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    processBarcode(barcodeInput);
                                }
                            }}
                            disabled={isProcessing}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            edge="end"
                                            color="primary"
                                            onClick={() => processBarcode(barcodeInput)}
                                            disabled={isProcessing || !barcodeInput}
                                        >
                                            {isProcessing ? <CircularProgress size={24} /> : <SearchIcon />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>
                </Paper>

                {/* Camera view */}
                <Collapse in={isCameraOpen}>
                    <Card
                        elevation={3}
                        sx={{
                            position: 'relative',
                            mb: 2,
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}
                    >
                        <Box sx={{ position: 'relative' }}>
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                autoPlay={!!isCameraOpen}
                                videoConstraints={{
                                    facingMode: { exact: 'environment' }, // Prefer back camera
                                    width: { min: 720, ideal: 1280, max: 1920 },
                                    height: { min: 480, ideal: 720, max: 1080 },
                                    aspectRatio: { ideal: 4 / 3 },
                                    focusMode: 'continuous', // Keep focus continuous
                                    iso: { max: 4000, min: 20, step: 1 },
                                    torch: false,
                                    // Higher frame rate for better scanning chances
                                    frameRate: { min: 15, ideal: 30 },
                                }}
                                style={{
                                    width: '100%',
                                    height: '300px',
                                    objectFit: 'cover',
                                }}
                            />

                            {/* Camera controls */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    padding: 1,
                                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <Typography variant="caption" sx={{ color: 'white' }}>
                                    Point camera at barcode
                                </Typography>

                                <IconButton color="inherit" onClick={toggleCamera} sx={{ color: 'white' }}>
                                    <CloseIcon />
                                </IconButton>
                            </Box>

                            {/* Camera selection */}
                            {cameraDevices.length > 1 && (
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        padding: 1,
                                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                                        display: 'flex',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <ToggleButtonGroup
                                        value={selectedCamera}
                                        exclusive
                                        onChange={(_, newValue) => {
                                            if (newValue !== null) {
                                                setSelectedCamera(newValue);
                                            }
                                        }}
                                        size="small"
                                        sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }}
                                    >
                                        {cameraDevices.map((device) => (
                                            <ToggleButton
                                                key={device.deviceId}
                                                value={device.deviceId}
                                                sx={{
                                                    color: 'white',
                                                    '&.Mui-selected': {
                                                        bgcolor: 'rgba(255, 255, 255, 0.3)',
                                                        color: 'white',
                                                    },
                                                }}
                                            >
                                                {device.label.includes('back')
                                                    ? 'Back'
                                                    : device.label.includes('front')
                                                    ? 'Front'
                                                    : `Camera ${cameraDevices.indexOf(device) + 1}`}
                                            </ToggleButton>
                                        ))}
                                    </ToggleButtonGroup>
                                </Box>
                            )}

                            {/* Scanner overlay */}
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: '80%',
                                    height: '100px',
                                    border: '2px solid',
                                    borderColor: 'primary.main',
                                    borderRadius: 1,
                                    boxShadow: '0 0 0 1000px rgba(0, 0, 0, 0.3)',
                                    clipPath:
                                        'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 100% 0%, 100% 100%, 0% 100%)',
                                }}
                            />
                        </Box>
                    </Card>
                </Collapse>

                {/* Invoice items */}
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
                        mb: 2,
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
                            Invoice Items ({invoiceItems.length})
                        </Typography>

                        {invoiceItems.length > 0 && (
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<DeleteIcon />}
                                onClick={() => {
                                    showDialog('Clear Invoice', 'Are you sure you want to clear all items?', [
                                        {
                                            text: 'Cancel',
                                            color: 'inherit',
                                            variant: 'outlined',
                                            handler: () => hideDialog(),
                                        },
                                        {
                                            text: 'Clear',
                                            color: 'error',
                                            variant: 'contained',
                                            handler: () => {
                                                setInvoiceItems([]);
                                                showSnackbar('Invoice cleared', 'success');
                                            },
                                        },
                                    ]);
                                }}
                            >
                                Clear
                            </Button>
                        )}
                    </Box>

                    {invoiceItems.length === 0 ? (
                        <Box
                            sx={{
                                flexGrow: 1,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                p: 3,
                            }}
                        >
                            <ScannerIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="body1" color="text.secondary">
                                Scan a barcode to add items
                            </Typography>
                        </Box>
                    ) : (
                        <List sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
                            {invoiceItems.map((item, index) => (
                                <ListItem
                                    key={`${item.id}-${index}`}
                                    divider
                                    secondaryAction={
                                        <IconButton edge="end" onClick={() => openEditDialog(item, index)}>
                                            <EditIcon />
                                        </IconButton>
                                    }
                                >
                                    <ListItemText
                                        primary={item.sku_name}
                                        secondary={
                                            <Typography variant="body2" color="text.secondary" component="span">
                                                {item.quantity} x {formatCurrency(item.price)} =
                                                <Typography
                                                    component="span"
                                                    fontWeight="bold"
                                                    color="primary.main"
                                                    sx={{ ml: 1 }}
                                                >
                                                    {formatCurrency(item.total)}
                                                </Typography>
                                            </Typography>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Paper>

                {/* Total and actions */}
                <Paper
                    elevation={3}
                    component={motion.div}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    sx={{ p: 2 }}
                >
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" align="right">
                            Total: {formatCurrency(calculateTotal())}
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="contained"
                            color={isPaid ? 'success' : 'error'}
                            fullWidth
                            onClick={togglePaymentStatus}
                            sx={{
                                py: 1.5,
                                fontWeight: 'bold',
                            }}
                        >
                            {isPaid ? 'PAID' : 'UNPAID'}
                        </Button>

                        <Button
                            variant="contained"
                            color="primary"
                            fullWidth
                            startIcon={<SaveIcon />}
                            onClick={saveInvoice}
                            disabled={invoiceItems.length === 0}
                            sx={{
                                py: 1.5,
                                fontWeight: 'bold',
                            }}
                        >
                            SAVE INVOICE
                        </Button>
                    </Box>
                </Paper>

                {/* Add product FAB */}
                <Zoom in={true}>
                    <Fab
                        color="secondary"
                        aria-label="add product"
                        sx={{
                            position: 'fixed',
                            bottom: 20,
                            right: 20,
                        }}
                        onClick={() => navigate('/product/create')}
                    >
                        <AddIcon />
                    </Fab>
                </Zoom>
            </Box>

            {/* Edit item dialog */}
            <Dialog open={isEditDialogOpen} onClose={closeEditDialog} fullWidth maxWidth="xs">
                <DialogTitle>Edit Item</DialogTitle>

                <DialogContent dividers>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                        {editItem?.sku_name}
                    </Typography>

                    <Box sx={{ my: 3 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Quantity:
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 3,
                            }}
                        >
                            <IconButton color="primary" onClick={() => setEditQuantity(Math.max(1, editQuantity - 1))}>
                                <RemoveCircleIcon />
                            </IconButton>

                            <Typography
                                variant="h6"
                                component="div"
                                sx={{
                                    mx: 2,
                                    minWidth: '60px',
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                }}
                            >
                                {editQuantity}
                            </Typography>

                            <IconButton color="primary" onClick={() => setEditQuantity(editQuantity + 1)}>
                                <AddCircleIcon />
                            </IconButton>
                        </Box>

                        <TextField
                            label="Price"
                            type="number"
                            value={editPrice}
                            defaultValue={editItem?.price ?? 0}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (value && value.length > 1 && value[0] === '0') {
                                    e.target.value = value.slice(1);
                                    setEditPrice(value.slice(1));
                                } else {
                                    setEditPrice(value);
                                }
                            }}
                            fullWidth
                            variant="outlined"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">₸</InputAdornment>,
                            }}
                        />

                        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                Total:
                            </Typography>
                            <Typography variant="h6" color="primary.main" fontWeight="bold">
                                {formatCurrency(editPrice * editQuantity)}
                            </Typography>
                        </Box>
                    </Box>
                </DialogContent>

                <DialogActions sx={{ p: 2 }}>
                    <Button
                        onClick={() => removeItem(editIndex)}
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                    >
                        Remove
                    </Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button onClick={closeEditDialog}>Cancel</Button>
                    <Button onClick={saveEditedItem} variant="contained">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>
        </Layout>
    );
};

export default ScanInvoice;
