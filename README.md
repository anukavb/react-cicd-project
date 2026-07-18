# React CI/CD Pipeline with Jenkins, Docker, SonarQube, Trivy, Terraform & Amazon EKS

An end-to-end DevOps CI/CD pipeline for a React application that automates code checkout, dependency installation, testing, static code analysis, security scanning, Docker image creation, container image scanning, image publishing, infrastructure provisioning, and deployment to Amazon Elastic Kubernetes Service (EKS).

---

## Overview

This project demonstrates a complete CI/CD workflow using modern DevOps tools. Every code change pushed to the repository is processed through a Jenkins pipeline that performs quality checks, security scans, containerization, and deployment to a Kubernetes cluster running on AWS.

---

## Pipeline Workflow

```text
GitHub
   │
   ▼
Jenkins Pipeline
   │
   ├── Checkout Source Code
   ├── Install Dependencies
   ├── Run Unit Tests
   ├── SonarQube Code Analysis
   ├── Trivy File System Scan
   ├── Build Docker Image
   ├── Trivy Image Scan
   ├── Push Image to Docker Hub
   ├── Provision Infrastructure (Terraform)
   ├── Configure kubectl
   ├── Deploy to Amazon EKS
   └── Verify Deployment
```

---

## Technology Stack

| Category                | Tools                   |
| ----------------------- | ----------------------- |
| Frontend                | React                   |
| CI/CD                   | Jenkins                 |
| Containerization        | Docker                  |
| Code Quality            | SonarQube               |
| Security Scanning       | Trivy                   |
| Infrastructure as Code  | Terraform               |
| Container Orchestration | Kubernetes (Amazon EKS) |
| Cloud Provider          | AWS                     |
| Container Registry      | Docker Hub              |

---

## Project Structure

```text
.
├── Jenkinsfile
├── Dockerfile
├── nginx.conf
├── sonar-project.properties
├── package.json
├── package-lock.json
├── src/
├── public/
├── terraform/
│   ├── providers.tf
│   ├── variables.tf
│   ├── vpc.tf
│   ├── iam.tf
│   ├── eks.tf
│   ├── outputs.tf
│   └── terraform.tfvars
├── k8s/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
└── README.md
```

---

# Prerequisites

Install the following software before running the project:

* Node.js
* Docker Desktop
* Jenkins
* Terraform
* AWS CLI
* kubectl
* Trivy
* Git

---

# Infrastructure Deployment

Navigate to the Terraform directory.

```bash
cd terraform
```

Initialize Terraform.

```bash
terraform init
```

Review the execution plan.

```bash
terraform plan -out=tfplan
```

Provision the AWS infrastructure.

```bash
terraform apply tfplan
```

After the cluster is created, configure kubectl.

```bash
aws eks update-kubeconfig --region <aws-region> --name <eks-cluster-name>
```

Verify the cluster.

```bash
kubectl get nodes
```

---

# Build and Test Docker Image

Build the Docker image.

```bash
docker build -t <dockerhub-username>/react-cicd-app .
```

Run the container locally.

```bash
docker run -d -p 8081:8080 <dockerhub-username>/react-cicd-app
```

Open:

```
http://localhost:8081
```

Push the image.

```bash
docker login
docker push <dockerhub-username>/react-cicd-app
```

---

# SonarQube Setup

Run SonarQube using Docker.

```bash
docker run -d \
--name sonarqube \
-p 9000:9000 \
sonarqube:lts-community
```

Open:

```
http://localhost:9000
```

Create a project and generate a user token.

---

# Jenkins Configuration

Install the following plugins:

* NodeJS Plugin
* SonarQube Scanner for Jenkins
* AWS Credentials Plugin

Configure the following tools:

* NodeJS
* SonarScanner

Create the following Jenkins credentials:

| Credential        | Type                |
| ----------------- | ------------------- |
| dockerhub-creds   | Username & Password |
| aws-jenkins-creds | AWS Credentials     |
| SonarQube Token   | Secret Text         |

Create a Pipeline job and configure it to use:

* Git repository
* Main branch
* Jenkinsfile

---

# Jenkinsfile Configuration

Update the following variables before executing the pipeline.

```groovy
DOCKER_IMAGE = "yourdockerhubusername/react-cicd-app"

AWS_REGION = "your-region"
```

---

# Running the Pipeline

From Jenkins:

1. Open the pipeline job.
2. Click **Build Now**.
3. Monitor the pipeline stages until completion.

---

# Verify Deployment

Check the running pods.

```bash
kubectl get pods -n react-app
```

Check the service.

```bash
kubectl get svc -n react-app
```

Retrieve the external endpoint.

```bash
kubectl get svc react-app-service -n react-app
```

Open the Load Balancer URL in a browser to access the application.

---

# Destroy Infrastructure

Delete the Kubernetes resources.

```bash
kubectl delete -f k8s/
```

Destroy the AWS infrastructure.

```bash
cd terraform

terraform destroy
```

---

# Features

* Fully automated CI/CD pipeline
* Automated React application build
* Unit testing
* Static code analysis with SonarQube
* File system vulnerability scanning with Trivy
* Docker image vulnerability scanning
* Multi-stage Docker build
* Docker Hub image publishing
* Infrastructure provisioning using Terraform
* Automated deployment to Amazon EKS
* Kubernetes rollout verification

---

# Future Improvements

* GitHub webhook-based automatic builds
* HTTPS with AWS Load Balancer Controller and ACM
* Helm chart deployment
* Monitoring using Prometheus and Grafana
* Centralized logging with the ELK Stack

---

# License

This project is intended for educational purposes.
