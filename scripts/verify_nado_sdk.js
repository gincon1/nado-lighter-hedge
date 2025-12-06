#!/usr/bin/env node
/**
 * Nado SDK 验证测试脚本
 * 检查 SDK 实现是否符合官方标准
 */

const { coinToSymbol, Deployments, ChainId } = require('../nado-sdk/src/types');
const { 
  getNadoEIP712Domain, 
  getPlaceOrderTypes, 
  getCancelOrdersTypes,
  getOrderVerifyingAddress,
  subaccountToHex 
} = require('../nado-sdk/src/signer');
const { 
  packOrderAppendix, 
  unpackOrderAppendix,
  getOrderNonce,
  addDecimals,
  toIntegerString
} = require('../nado-sdk/src/orders');

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║            Nado SDK 验证测试                              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

let passed = 0;
let failed = 0;

function test(name, condition, expected, actual) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    console.log(`   期望: ${JSON.stringify(expected)}`);
    console.log(`   实际: ${JSON.stringify(actual)}`);
    failed++;
  }
}

// 1. 测试 EIP-712 Domain
console.log('--- 1. EIP-712 Domain 测试 ---');
const domain = getNadoEIP712Domain('0x0000000000000000000000000000000000000001', 763373);
test('Domain name', domain.name === 'Nado', 'Nado', domain.name);
test('Domain version', domain.version === '0.0.1', '0.0.1', domain.version);
test('Domain chainId', domain.chainId === 763373, 763373, domain.chainId);

// 2. 测试 Order 类型
console.log('\n--- 2. Order 类型测试 ---');
const orderTypes = getPlaceOrderTypes();
const expectedFields = ['sender', 'priceX18', 'amount', 'expiration', 'nonce', 'appendix'];
const actualFields = orderTypes.Order.map(f => f.name);
test('Order 字段', 
  expectedFields.every(f => actualFields.includes(f)),
  expectedFields, actualFields
);

// 3. 测试 verifyingContract 地址
console.log('\n--- 3. verifyingContract 地址测试 ---');
const addr1 = getOrderVerifyingAddress(1);
test('ProductId 1', addr1 === '0x0000000000000000000000000000000000000001', 
  '0x0000000000000000000000000000000000000001', addr1);

const addr4 = getOrderVerifyingAddress(4);
test('ProductId 4', addr4 === '0x0000000000000000000000000000000000000004',
  '0x0000000000000000000000000000000000000004', addr4);

// 4. 测试 Subaccount 格式
console.log('\n--- 4. Subaccount 格式测试 ---');
const testAddress = '0x7a5ec2748e9065794491a8d29dcf3f9edb8d7c43';
const subaccount = subaccountToHex(testAddress, '');
test('Subaccount 长度', subaccount.length === 66, 66, subaccount.length); // 0x + 64 chars = 66
test('Subaccount 包含地址', subaccount.toLowerCase().includes('7a5ec2748e9065794491a8d29dcf3f9edb8d7c43'), true, 
  subaccount.toLowerCase().includes('7a5ec2748e9065794491a8d29dcf3f9edb8d7c43'));

// 5. 测试 Appendix 打包
console.log('\n--- 5. Appendix 打包测试 ---');
const appendix = packOrderAppendix({
  orderExecutionType: 'post_only',
  reduceOnly: false,
  isolated: false,
  triggerType: null
});
// POST_ONLY = 3, version = 1, 应该得到 appendix = 1537 (0x601)
// 位布局: orderType(3) << 9 | isolated(0) << 8 | version(1) = 0x601 = 1537
const unpacked = unpackOrderAppendix(appendix);
test('Appendix 解包 orderType', unpacked.orderExecutionType === 'post_only', 'post_only', unpacked.orderExecutionType);
test('Appendix 解包 version', unpacked.version === 1, 1, unpacked.version);

// 6. 测试 Nonce 生成
console.log('\n--- 6. Nonce 生成测试 ---');
const nonce1 = getOrderNonce();
const nonce2 = getOrderNonce();
test('Nonce 不为空', nonce1 !== '', true, nonce1 !== '');
test('Nonce 唯一', nonce1 !== nonce2, true, nonce1 !== nonce2);
test('Nonce 是大数', BigInt(nonce1) > 0n, true, BigInt(nonce1) > 0n);

// 7. 测试精度转换
console.log('\n--- 7. 精度转换测试 ---');
const price = 50000;
const priceX18 = addDecimals(price);
const priceStr = toIntegerString(priceX18);
test('价格转换正确', priceStr === '50000000000000000000000', '50000000000000000000000', priceStr);

// 8. 测试币种映射
console.log('\n--- 8. 币种映射测试 ---');
test('BTC 映射', coinToSymbol('BTC') === 'BTC-PERP', 'BTC-PERP', coinToSymbol('BTC'));
test('ETH 映射', coinToSymbol('ETH') === 'ETH-PERP', 'ETH-PERP', coinToSymbol('ETH'));
test('SOL 映射', coinToSymbol('SOL') === 'SOL-PERP', 'SOL-PERP', coinToSymbol('SOL'));

// 9. 测试网络配置
console.log('\n--- 9. 网络配置测试 ---');
test('Mainnet ChainId', Deployments.inkMainnet.chainId === 57073, 57073, Deployments.inkMainnet.chainId);
test('Testnet ChainId', Deployments.inkTestnet.chainId === 763373, 763373, Deployments.inkTestnet.chainId);

// 结果汇总
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log(`║  测试结果: ${passed} 通过, ${failed} 失败                          ║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  process.exit(1);
}
