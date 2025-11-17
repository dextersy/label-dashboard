import { Request, Response } from 'express';
import { LabelPaymentMethod, LabelPayment, Brand } from '../models';
import { PaymentService } from '../utils/paymentService';

interface AuthRequest extends Request {
  user?: any;
}

// LABEL PAYMENT METHODS MANAGEMENT
export const addLabelPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      type,
      account_name,
      account_number_or_email,
      bank_code,
      is_default_for_brand = false
    } = req.body;

    if (!type || !account_name || !account_number_or_email) {
      return res.status(400).json({ 
        error: 'Type, account name, and account number/email are required' 
      });
    }

    // If this is being set as default, unset other defaults for this brand
    if (is_default_for_brand) {
      await LabelPaymentMethod.update(
        { is_default_for_brand: false },
        { where: { brand_id: req.user.brand_id } }
      );
    }

    const paymentMethod = await LabelPaymentMethod.create({
      brand_id: req.user.brand_id,
      type,
      account_name,
      account_number_or_email,
      bank_code: bank_code || 'N/A',
      is_default_for_brand: is_default_for_brand || false
    });

    res.status(201).json({
      message: 'Label payment method added successfully',
      paymentMethod
    });
  } catch (error) {
    console.error('Add label payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLabelPaymentMethods = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { brandId } = req.params;
    const targetBrandId = parseInt(brandId, 10);

    if (!targetBrandId || isNaN(targetBrandId)) {
      return res.status(400).json({ error: 'Valid brand ID is required' });
    }

    // Allow access if:
    // 1. User is requesting their own brand's payment methods
    // 2. User is requesting a sublabel's payment methods (parent brand access)
    if (targetBrandId !== req.user.brand_id) {
      // Verify that the target brand is a child of the current user's brand
      const targetBrand = await Brand.findOne({
        where: {
          id: targetBrandId,
          parent_brand: req.user.brand_id
        }
      });

      if (!targetBrand) {
        return res.status(404).json({ error: 'Brand not found or not accessible' });
      }
    }

    const paymentMethods = await LabelPaymentMethod.findAll({
      where: { brand_id: targetBrandId },
      order: [['is_default_for_brand', 'DESC'], ['id', 'DESC']]
    });

    res.json({ paymentMethods });
  } catch (error) {
    console.error('Get label payment methods error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateLabelPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;
    const {
      type,
      account_name,
      account_number_or_email,
      bank_code,
      is_default_for_brand
    } = req.body;

    const paymentMethod = await LabelPaymentMethod.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // If this is being set as default, unset other defaults for this brand
    if (is_default_for_brand) {
      await LabelPaymentMethod.update(
        { is_default_for_brand: false },
        { where: { brand_id: req.user.brand_id } }
      );
    }

    await paymentMethod.update({
      type: type || paymentMethod.type,
      account_name: account_name || paymentMethod.account_name,
      account_number_or_email: account_number_or_email || paymentMethod.account_number_or_email,
      bank_code: bank_code !== undefined ? bank_code : paymentMethod.bank_code,
      is_default_for_brand: is_default_for_brand !== undefined ? is_default_for_brand : paymentMethod.is_default_for_brand
    });

    res.json({
      message: 'Label payment method updated successfully',
      paymentMethod
    });
  } catch (error) {
    console.error('Update label payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const setDefaultLabelPaymentMethod = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const paymentMethod = await LabelPaymentMethod.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      }
    });

    if (!paymentMethod) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Unset all defaults for this brand
    await LabelPaymentMethod.update(
      { is_default_for_brand: false },
      { where: { brand_id: req.user.brand_id } }
    );

    // Set this one as default
    await paymentMethod.update({ is_default_for_brand: true });

    res.json({
      message: 'Default label payment method set successfully',
      paymentMethod
    });
  } catch (error) {
    console.error('Set default label payment method error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// LABEL PAYMENTS MANAGEMENT
export const addLabelPayment = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { brandId } = req.params; // Get the target sublabel's brand ID from route params
    const targetBrandId = parseInt(brandId, 10);

    if (!targetBrandId || isNaN(targetBrandId)) {
      return res.status(400).json({ error: 'Valid brand ID is required' });
    }

    // Verify that the target brand is a child of the current user's brand (security check)
    const targetBrand = await Brand.findOne({
      where: { 
        id: targetBrandId,
        parent_brand: req.user.brand_id 
      }
    });

    if (!targetBrand) {
      return res.status(404).json({ error: 'Sublabel not found or not accessible' });
    }

    const {
      amount,
      description,
      date_paid,
      paid_thru_type,
      paid_thru_account_name,
      paid_thru_account_number,
      payment_method_id,
      reference_number,
      payment_processing_fee,
      manualPayment
    } = req.body;

    if (!amount || amount <= 0 || !date_paid) {
      return res.status(400).json({ 
        error: 'Amount (greater than 0) and date are required' 
      });
    }

    let finalAmount = amount;
    let finalProcessingFee = payment_processing_fee || 0;
    let finalReferenceNumber = reference_number;

    // Handle Paymongo payment processing for non-manual payments
    if (payment_method_id && payment_method_id !== '-1' && manualPayment !== '1') {
      try {
        const paymentService = new PaymentService();
        const parentBrand = await Brand.findByPk(req.user.brand_id);
        
        if (!parentBrand || !parentBrand.paymongo_wallet_id) {
          return res.status(400).json({ error: 'Brand wallet not configured for payments' });
        }

        // Calculate processing fee
        const processingFee = parentBrand.payment_processing_fee_for_payouts || 0;
        const transferAmount = amount - processingFee;

        // Send money through Paymongo
        const referenceNumber = await paymentService.sendMoneyTransfer(
          req.user.brand_id,
          payment_method_id,
          transferAmount,
          description,
          true // isLabelPayment = true
        );

        if (!referenceNumber) {
          return res.status(400).json({ error: 'Payment processing failed' });
        }

        finalProcessingFee = processingFee;
        finalReferenceNumber = referenceNumber;
      } catch (error) {
        console.error('Paymongo payment error:', error);
        return res.status(500).json({ error: 'Payment processing failed' });
      }
    }

    // Create payment object - prioritize payment_method_id over legacy paid_thru_* fields
    const paymentData: any = {
      brand_id: targetBrandId, // Use the target sublabel's brand ID
      amount: parseFloat(finalAmount.toFixed(2)),
      description,
      date_paid: new Date(date_paid),
      reference_number: finalReferenceNumber,
      payment_processing_fee: finalProcessingFee
    };

    // Set payment_method_id if provided, otherwise fall back to legacy fields
    if (payment_method_id && payment_method_id !== '-1') {
      // Verify payment method belongs to the sublabel (payment methods are stored for the target brand)
      const paymentMethod = await LabelPaymentMethod.findOne({
        where: {
          id: payment_method_id,
          brand_id: targetBrandId  // Changed from req.user.brand_id to targetBrandId
        }
      });

      if (!paymentMethod) {
        return res.status(404).json({ error: 'Payment method not found' });
      }

      paymentData.payment_method_id = payment_method_id;
    } else {
      // Only set legacy fields if no payment_method_id is provided
      paymentData.paid_thru_type = paid_thru_type;
      paymentData.paid_thru_account_name = paid_thru_account_name;
      paymentData.paid_thru_account_number = paid_thru_account_number;
    }

    const payment = await LabelPayment.create(paymentData);

    res.status(201).json({
      message: 'Label payment added successfully',
      payment
    });
  } catch (error) {
    console.error('Add label payment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLabelPayments = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { page = '1', limit = '10', sortBy, sortDirection, ...filters } = req.query;

    const pageNum = parseInt(page as string);
    const pageSize = parseInt(limit as string);
    const offset = (pageNum - 1) * pageSize;

    // Build where conditions based on filters
    const where: any = { brand_id: req.user.brand_id };
    
    // Add search filters
    if (filters.description && filters.description !== '') {
      where.description = { [require('sequelize').Op.like]: `%${filters.description}%` };
    }
    
    if (filters.paid_thru_type && filters.paid_thru_type !== '') {
      where.paid_thru_type = { [require('sequelize').Op.like]: `%${filters.paid_thru_type}%` };
    }
    
    if (filters.amount && filters.amount !== '') {
      where.amount = parseFloat(filters.amount as string);
    }
    
    if (filters.payment_processing_fee && filters.payment_processing_fee !== '') {
      where.payment_processing_fee = parseFloat(filters.payment_processing_fee as string);
    }
    
    if (filters.date_paid && filters.date_paid !== '') {
      // Search by date (exact match for the day)
      const searchDate = new Date(filters.date_paid as string);
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      where.date_paid = {
        [require('sequelize').Op.gte]: searchDate,
        [require('sequelize').Op.lt]: nextDay
      };
    }

    // Build order clause
    let orderClause: any[] = [['date_paid', 'DESC']]; // Default order
    
    if (sortBy && sortDirection) {
      const validSortColumns = ['date_paid', 'description', 'paid_thru_type', 'amount', 'payment_processing_fee'];
      const validDirections = ['asc', 'desc'];
      
      if (validSortColumns.includes(sortBy as string) && validDirections.includes((sortDirection as string).toLowerCase())) {
        orderClause = [[sortBy as string, (sortDirection as string).toUpperCase()]];
      }
    }

    // Get payments with pagination and filters
    const { count, rows: payments } = await LabelPayment.findAndCountAll({
      where,
      include: [
        {
          model: LabelPaymentMethod,
          as: 'paymentMethod',
          required: false // Left join - include payments without payment methods
        }
      ],
      order: orderClause,
      limit: pageSize,
      offset: offset
    });

    const totalPages = Math.ceil(count / pageSize);

    res.json({ 
      payments,
      pagination: {
        current_page: pageNum,
        total_pages: totalPages,
        total_count: count,
        per_page: pageSize,
        has_next: pageNum < totalPages,
        has_prev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Get label payments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLabelPaymentById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user.is_admin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.params;

    const payment = await LabelPayment.findOne({
      where: { 
        id,
        brand_id: req.user.brand_id 
      },
      include: [
        {
          model: LabelPaymentMethod,
          as: 'paymentMethod',
          required: false
        }
      ]
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('Get label payment by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};