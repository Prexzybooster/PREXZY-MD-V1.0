const { DataTypes, Op } = require('sequelize');
const config = require('../../config');
const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 
    'September', 'October', 'November', 'December'
];

const uidField = { allowNull: false, type: DataTypes.STRING };
const yearField = { allowNull: false, type: DataTypes.STRING };
const monthField = { allowNull: false, type: DataTypes.STRING };
const dayField = { allowNull: false, type: DataTypes.STRING };
const typeField = { allowNull: false, type: DataTypes.STRING };
const amountField = { allowNull: false, type: DataTypes.INTEGER };
const categoryField = { allowNull: false, type: DataTypes.STRING };
const remarkField = { allowNull: false, type: DataTypes.TEXT };

const budgetSchema = {
    uid: uidField,
    year: yearField,
    month: monthField,
    day: dayField,
    type: typeField,
    amount: amountField,
    category: categoryField,
    remark: remarkField,
};

const Budget = config.DATABASE.define('budget', budgetSchema);

exports.detBudget = async function (uid, id) {
    const whereClause = { where: { uid, id } };
    const budgetRecords = await Budget.findAll(whereClause);

    if (budgetRecords.length) {
        await budgetRecords[0].destroy();
        return true;
    }
    return false;
};

async function calculateTotal(uid, type) {
    const currentMonth = months[new Date().getMonth()];
    const currentYear = new Date().getFullYear();
    const whereClause = { where: { uid, type, month: currentMonth, year: currentYear } };

    const budgetRecords = await Budget.findAll(whereClause);

    let totalAmount = 0;
    for (const record of budgetRecords) {
        totalAmount += record.amount;
    }
    return totalAmount;
}

exports.setBudget = async function (uid, type, category, amount, remark = '', month, year) {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = month ?? months[today.getMonth()];
    const currentYear = year ?? today.getFullYear();

    const whereClause = { where: { uid, type, category, month: currentMonth, year: currentYear } };
    const existingBudget = await Budget.findAll(whereClause);

    if (existingBudget.length > 0) {
        const updateData = { uid, year: currentYear, month: currentMonth, remark, day: currentDay, type, amount };
        await existingBudget[0].update(updateData);
    } else {
        const newBudget = { uid, year: currentYear, category, month: currentMonth, type, amount, day: currentDay, remark };
        await Budget.create(newBudget);
    }
    return await calculateTotal(uid, type);
};

exports.getBudget = async function (uid, month, type, year, dateRange) {
    const conditions = { month, type };

    if (uid) {
        conditions.uid = uid;
    }

    if (dateRange) {
        const [startDay, startMonth, startYear] = dateRange.from.split(' ');
        const [endDay, endMonth, endYear] = dateRange.to.split(' ');

        const formattedStartMonth = startMonth.charAt(0).toUpperCase() + startMonth.slice(1);
        const formattedEndMonth = endMonth.charAt(0).toUpperCase() + endMonth.slice(1);

        const startMonthIndex = months.indexOf(formattedStartMonth);
        const endMonthIndex = months.indexOf(formattedEndMonth);

        let monthDifference = Math.abs(startMonthIndex - endMonthIndex);

        if (monthDifference > 1) {
            let currentMonthIndex = startMonthIndex;
            const monthArray = [];
            while (currentMonthIndex != (endMonthIndex + 1)) {
                const monthName = months[currentMonthIndex];
                if (monthName) {
                    monthArray.push(monthName);
                    currentMonthIndex++;
                    monthDifference--;
                } else {
                    currentMonthIndex = 0;
                }
            }
            conditions.month = { [Op.or]: monthArray };
        } else if (formattedStartMonth !== formattedEndMonth) {
            conditions.month = { [Op.or]: [formattedStartMonth, formattedEndMonth] };
        }

        if (startYear !== endYear) {
            conditions.year = { [Op.or]: [startYear, endYear] };
        } else {
            conditions.year = endYear;
        }

        const whereClause = { where: conditions };
        const budgetRecords = await Budget.findAll(whereClause);

        if (budgetRecords.length < 1) {
            return [];
        }
        return budgetRecords.filter(record => {
            const startCondition = record.month === formattedStartMonth && record.day >= startDay;
            const endCondition = record.month === formattedEndMonth && record.day <= endDay;
            return monthDifference > 1 ? record.month !== formattedStartMonth && record.month !== formattedEndMonth : startCondition && endCondition;
        });
    } else {
        if (month) conditions.month = month;
        if (type) conditions.type = type;
        if (year) conditions.year = year;

        const whereClause = { where: conditions };
        const budgetRecords = await Budget.findAll(whereClause);

        return budgetRecords;
    }
};
