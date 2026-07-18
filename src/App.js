import React from 'react';

function App() {
  return (
    <div style={{ fontFamily: 'sans-serif', textAlign: 'center', marginTop: '80px' }}>
      <h1>React CI/CD Pipeline Demo</h1>
      <p>Jenkins → Docker → SonarQube → Trivy → Terraform → Amazon EKS</p>
      <p>If you can see this page, the deployment pipeline worked end-to-end. 🎉</p>
    </div>
  );
}

export default App;
