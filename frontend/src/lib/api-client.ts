import { API_BASE } from '../api';

const API_BASE_URL = API_BASE;

export const api = {
    async createLead(data: {
        name: string;
        contact_method: string;
        contact_value: string;
        bike_interest?: string;
        notes?: string;
    }) {
        const response = await fetch(`${API_BASE_URL}/v1/crm/leads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error('Failed to create lead');
        }
        return response.json();
    },

    async quickOrder(data: {
        name: string;
        contact_method: string;
        contact_value: string;
        notes?: string;
    }) {
        const response = await fetch(`${API_BASE_URL}/v1/crm/orders/quick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error('Failed to create quick order');
        }
        return response.json();
    },

    async checkout(data: any) {
        // Using the quick order endpoint for guest checkout which handles application + order creation
        const response = await fetch(`${API_BASE_URL}/v1/crm/orders/quick`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: data.name,
                contact_method: data.phone ? 'phone' : 'email',
                contact_value: data.phone || data.email,
                notes: `Address: ${data.address}, City: ${data.city}. Delivery: ${data.delivery_method}. Payment: ${data.payment_method}`
            }),
        });
        if (!response.ok) {
            throw new Error('Failed to checkout');
        }
        return response.json();
    }
};
