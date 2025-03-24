/**
 * API Client for communicating with the backend server
 * Modified to work without an actual API server
 */
class ApiClient {
  constructor() {
    // Default API base URL (not used in local mode)
    this.baseUrl = 'http://192.168.31.97:8000';
    this.authToken = null;
  }

  /**
   * Set the API base URL
   * @param {string} url - The base URL for API requests
   */
  setBaseUrl(url) {
    this.baseUrl = url;
  }

  /**
   * Set the authentication token
   * @param {string} token - The auth token to use for requests
   */
  setAuthToken(token) {
    this.authToken = token;
  }

  /**
   * Get default headers for API requests
   * @returns {Object} - Headers object
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.authToken) {
      headers['X-API-Key'] = this.authToken;
      console.log("Token passed in X-API-Key header:", this.authToken.substring(0, 20) + "...");
    } else {
      console.warn("Token not set! Request will be made without authorization.");
    }

    return headers;
  }

  /**
   * Show error in the console
   * @param {string} message - Error message to display
   */
  logError(message) {
    console.error(message);
  }

  /**
   * Make an API request or simulate a response in local mode
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Response data
   */
  async apiRequest(endpoint, options = {}) {
    // Real API call logic
    const url = this.baseUrl + endpoint;
    const isProductLookup = endpoint.includes('/products/global/by-barcode/');

    const fetchOptions = {
      headers: this.getHeaders(),
      ...options
    };

    try {
      const response = await fetch(url, fetchOptions);
      console.log(`API Response [${response.status}]:`, url);

      if (response.ok) {
        console.log(`API Response [${response.status}]:`, url);
        return await response.json();
      }
      if (response.status === 401 || response.status === 403) {
        this.logError(`Authorization error (${response.status}). Please login again.`);

        if (!isProductLookup) {
          localStorage.removeItem('auth_token');
          window.dispatchEvent(new CustomEvent('auth-error'));
        }
      } else {
        this.logError(`API Error: ${response.status}`);
      }
      return null;
    } catch (error) {
      this.logError(`Connection error: ${error.message}`);
      return null;
    }
  }

  /**
   * Get a product by barcode
   * @param {string} barcode - Product barcode
   * @returns {Promise<Object|null>} - Product data or null if not found
   */
  async getProduct(barcode) {
    const data = await this.apiRequest(`/products/global/by-barcode/${barcode}`, {
      method: 'GET'
    });

    if (data) {
      // Map the API response to the format we expect
      return data;
    }

    return null;
  }

  /**
   * Login user and get auth token
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object|null>} - Auth data or null if login failed
   */
  async login(username, password) {
    const data = await this.apiRequest('/auth/token', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password
      })
    });

    if (data && data.access_token) {
      this.setAuthToken(data.access_token);
      return {
        token: data.access_token,
        user: data.user || { username }
      };
    }

    return null;
  }

  // * Local product methods (Products operations)
  async addLocalProduct(product) {
    console.log("Adding local product:", product);

    if (!product.barcode || !product.sku_name) {
      throw new Error('Product name and barcode are required');
    }

    // Add timestamps
    const newProduct = {
      "barcode": "",
      "unit": "",
      "sku_name": "",
      "status_1c": "",
      "department": "",
      "group_name": "",
      "subgroup": "",
      "supplier": "",
      "cost_price": 0,
      "price": 0,
      "quantity": 0,
      ...product
    };


    const res = await this.apiRequest('/products/local', {
      method: 'POST',
      body: JSON.stringify(newProduct)
    });

    const id = res.id;

    return id;
  }

  async updateLocalProduct(id, product) {
    console.log("Updating local product:", product);
    const res = await this.apiRequest(`/products/local/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    });
    return !!res;
  }

  async searchLocalProducts(searchTerm) {
    console.log("Searching local products:", searchTerm);
    const res = await this.apiRequest(`/products/local?search=${searchTerm}`, {
      method: 'GET'
    });
    return res?.content || [];
  }

  async byIdLocalProduct(id) {
    if (!id) return null;
    console.log("Getting local product by ID:", id);
    const res = await this.apiRequest(`/products/local/${id}`, {
      method: 'GET'
    });
    return res;
  }

  async getAllLocalProducts(sortBy) {
    console.log("Getting all local products");
    const res = await this.apiRequest(`/products/local/all${false ? `?sort_by=${sortBy}` : ''}`, {
      method: 'GET'
    });
    return res;
  }

  async deleteLocalProduct(id) {
    console.log("Deleting local product:", id);
    const res = await this.apiRequest(`/products/local/${id}`, {
      method: 'DELETE'
    });
    return !!res;
  }
  // *

  async createLocalInvoice(invoiceList = [], sale_status) {
    console.log("Creating invoice");
    if (invoiceList.length === 0) return null;
    const res = await this.apiRequest(`/sales/create${sale_status ? `?sale_status=${sale_status}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(invoiceList)
    });
    return res?.order_id;
  }

  async uprateLocalInvoiceStatus(order_id, sale_status) {
    console.log("Updating local invoice status:", order_id);
    const res = await this.apiRequest(`/sales/${order_id}/status?sale_status=${sale_status}`, {
      method: 'PATCH'
    });
    return res?.order_id;
  }

  async deleteLocalInvoice(order_id) {
    console.log("Deleting local invoice:", order_id);
    const res = await this.apiRequest(`/sales/cancel?order_id=${order_id}`, {
      method: 'DELETE'
    });
    return res?.order_id;
  }

  async getLocalInvoices() {
    console.log("Getting local invoices");
    const res = await this.apiRequest('/sales', {
      method: 'GET'
    });
    return res;
  }

  async byIdLocalInvoice(id) {
    if (!id) return null;
    console.log("Getting local invoice by ID:", id);
    const res = await this.apiRequest(`/sales/${id}`, {
      method: 'GET'
    });
    return res;
  }

  async getLocalInvoicesByPeriod(startDate, endDate) {
    console.log("Getting local invoices by period");
    const res = await this.apiRequest(`/sales?start_date=${startDate}&end_date=${endDate}`, {
      method: 'GET'
    });
    return res?.content || [];
  }

  async deleteLocalInvoice(id) {
    console.log("Deleting local invoice:", id);
    const res = await this.apiRequest(`/sales/cancel?order_id=${id}`, {
      method: 'DELETE'
    });
    return !!res;
  }
}

// Create a singleton instance
const apiClient = new ApiClient();

export default apiClient;