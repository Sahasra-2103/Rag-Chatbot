import fs from 'fs';

const qaPairs = [];
for (let i = 1; i <= 50; i++) {
  qaPairs.push({
    question: `How do I reset password for system ${i}?`,
    answer: `To reset your password for system ${i}, navigate to the Settings page of system ${i}, click on 'Security', and select 'Reset Password'. You will receive an email with instructions.`
  });
}

fs.writeFileSync('mock_data.json', JSON.stringify(qaPairs, null, 2));
console.log('Created mock_data.json with 50 pairs.');
