# React App → Jenkins → Docker → SonarQube → Trivy → Terraform → EKS

End-to-end CI/CD pipeline: code is checked out, tested, scanned, containerized,
scanned again, pushed to Docker Hub, and deployed to Amazon EKS — all via Jenkins.

## 0. What's in this project

```
.
├── Jenkinsfile                     # 15-stage pipeline
├── Dockerfile                      # multi-stage build (Node -> nginx)
├── nginx.conf                      # SPA-friendly nginx config
├── .dockerignore
├── sonar-project.properties
├── terraform/                      # provisions the EKS cluster + VPC
│   ├── providers.tf
│   ├── variables.tf
│   ├── vpc.tf
│   ├── iam.tf
│   ├── eks.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
├── k8s/                            # Kubernetes manifests
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml                # optional
└── README.md                       # this file
```

Since you said you have everything installed except Kubernetes tooling, **Step 1
covers installing `kubectl` only** — skip the rest of Step 1 if already done.

---

## Step 1: Install the one missing piece — `kubectl`

**Linux:**
```bash
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/
kubectl version --client
```

**macOS (Homebrew):**
```bash
brew install kubectl
kubectl version --client
```

**Windows (Chocolatey / winget):**
```powershell
choco install kubernetes-cli
# or
winget install -e --id Kubernetes.kubectl
```

Verify:
```bash
kubectl version --client
```

Also install the `kubectl` plugin on your **Jenkins agent** (same steps as
above, run on whichever machine actually executes the pipeline stages), since
the "Connect to EKS" and "Deploy" stages run `kubectl` from Jenkins, not your
laptop.

---

## Step 2: Provision the AWS infrastructure with Terraform

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars if you want different region/instance sizes

aws configure          # make sure your AWS CLI has credentials with
                        # EC2 / EKS / IAM / VPC permissions

terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

This creates:
- VPC with public + private subnets across 2 AZs
- Internet Gateway + single NAT Gateway
- Route tables for public/private routing
- Security group for node-to-node traffic
- IAM roles for the EKS control plane and node group
- The EKS cluster itself (`aws_eks_cluster`)
- A managed node group (2–4 `t3.medium` EC2 nodes)
- An OIDC provider (so you can later attach IAM roles to k8s service accounts,
  e.g. for the AWS Load Balancer Controller if you enable Ingress)

Takes ~12–15 minutes (EKS control plane provisioning is the slow part).

When done, point your local `kubectl` at it to confirm it's healthy:
```bash
aws eks update-kubeconfig --region us-east-1 --name react-app-eks-cluster
kubectl get nodes
```
You should see 2 nodes in `Ready` state.

---

## Step 3: Set up SonarQube

If you already have a SonarQube server running (e.g. `docker run -d --name sonarqube -p 9000:9000 sonarqube:lts-community`), just:

1. Log in at `http://<sonarqube-host>:9000` (default admin/admin, you'll be asked to change it).
2. Create a project with key `react-cicd-app` (matches `sonar-project.properties`).
3. Generate a token: **My Account → Security → Generate Token**. Save it.
4. In Jenkins: **Manage Jenkins → System → SonarQube servers** — add a server named
   `MySonarQubeServer` with the URL and a credential holding that token.
5. Also install the **SonarQube Scanner** plugin and configure a scanner tool
   in **Manage Jenkins → Tools**.
6. On the SonarQube project, set a **Webhook** (Administration → Webhooks)
   pointing to `http://<jenkins-host>:8080/sonarqube-webhook/` — this is what
   lets the `waitForQualityGate` step in the Jenkinsfile actually receive the
   pass/fail result instead of timing out.

---

## Step 4: Set up Trivy

If already installed from your last project, confirm the Jenkins agent has it
on PATH:
```bash
trivy --version
```
The pipeline's Trivy stage scans the built Docker image and:
- Writes LOW/MEDIUM findings to a report (non-blocking)
- **Fails the build** on HIGH/CRITICAL findings (unless you run the build with
  the `SKIP_TRIVY_BLOCK` parameter set to `true`)

---

## Step 5: Docker Hub credentials in Jenkins

**Manage Jenkins → Credentials → (global) → Add Credentials**
- Kind: Username with password (or Docker Hub access token as the password)
- ID: `dockerhub-creds` ← must match the Jenkinsfile's `credentials('dockerhub-creds')`

Update `DOCKER_IMAGE` in the `Jenkinsfile` to your actual Docker Hub
username/repo, e.g. `johnsmith/react-cicd-app`.

---

## Step 6: AWS credentials in Jenkins

Install the **Pipeline: AWS Steps** and **CloudBees AWS Credentials** plugins,
then:

**Manage Jenkins → Credentials → Add Credentials**
- Kind: AWS Credentials
- ID: `aws-jenkins-creds` ← must match `AWS_CREDENTIALS_ID` in the Jenkinsfile
- Access Key ID / Secret Access Key: from an IAM user (or better, an IAM role
  if your Jenkins runs on EC2) with EKS + EC2 describe/read permissions plus
  whatever's needed to run `kubectl` against the cluster.

**Important:** the IAM identity Jenkins authenticates as must be mapped into
the cluster's `aws-auth` ConfigMap (or, on newer EKS, the **EKS Access
Entries** feature) with at least `system:masters` or a scoped RBAC role,
otherwise `kubectl` commands will connect but get `Unauthorized`. If you
created the cluster with Terraform using a particular IAM user/role, that
identity is the initial admin — you'll need to explicitly grant Jenkins'
identity access too:
```bash
aws eks create-access-entry --cluster-name react-app-eks-cluster \
  --principal-arn arn:aws:iam::<account-id>:user/jenkins-user

aws eks associate-access-policy --cluster-name react-app-eks-cluster \
  --principal-arn arn:aws:iam::<account-id>:user/jenkins-user \
  --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
  --access-scope type=cluster
```

---

## Step 7: Wire up the Jenkins pipeline job

1. **New Item → Pipeline** (or Multibranch Pipeline if you want PR builds).
2. Pipeline script from SCM → point at your GitHub repo containing this
   project (make sure `Jenkinsfile` sits at the repo root, next to your React
   app's `package.json`).
3. Add a GitHub webhook (repo Settings → Webhooks) pointing at
   `http://<jenkins-host>:8080/github-webhook/` so pushes trigger builds
   automatically, or just configure "Poll SCM" / "GitHub hook trigger" in the
   job.
4. Make sure **Node.js** tool is configured in **Manage Jenkins → Tools** with
   the name `node18` (matches the `tools { nodejs 'node18' }` block), or
   change the name to whatever you've already got.

---

## Step 8: Run it

Click **Build Now** (or push a commit). The pipeline runs, in order:

| # | Stage | What happens |
|---|-------|---------------|
| 1 | Checkout | Pulls source from GitHub |
| 2 | Clean Workspace | Removes stale `node_modules`/`build` |
| 3 | Install Dependencies | `npm ci` |
| 4 | Unit Testing | `npm test -- --coverage` |
| 5 | Build React App | `npm run build` |
| 6 | SonarQube Scan | Static analysis + coverage upload |
| 7 | Quality Gate | Blocks pipeline if Sonar gate fails |
| 8 | Docker Build | Builds multi-stage image |
| 9 | Trivy Scan | Fails on HIGH/CRITICAL CVEs |
| 10 | Docker Push | Pushes `:BUILD_NUMBER` and `:latest` tags |
| 11 | Connect to EKS | `aws eks update-kubeconfig` + `kubectl get nodes` |
| 12 | Deploy to Kubernetes | Applies namespace/deployment/service/ingress |
| 13 | Verify Rollout | `kubectl rollout status` |
| 14 | Health Check | Curls the LoadBalancer hostname until it's up |

---

## Step 9: Confirm it's live

```bash
kubectl get svc react-app-service -n react-app
```
Grab the `EXTERNAL-IP` (a `*.elb.amazonaws.com` hostname) and open it in a
browser. DNS propagation for a fresh ELB can take a minute or two even after
`kubectl` shows it.

---

## Optional: Ingress instead of a bare LoadBalancer Service

`k8s/ingress.yaml` assumes the **AWS Load Balancer Controller** add-on is
installed on the cluster (it isn't by default). To use it:
```bash
# Install via Helm, after adding the eks charts repo
helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=react-app-eks-cluster \
  --set serviceAccount.create=true
```
It uses the OIDC provider Terraform already created (`eks.tf`) via IRSA. If
you don't need path-based routing / a single shared ALB across multiple
services, the plain `LoadBalancer` Service in Step 9 is simpler and sufficient
— you can skip Ingress entirely.

---

## Tearing it down

```bash
kubectl delete -f k8s/ -n react-app  # remove app + LB first, so Terraform
                                       # doesn't leave an orphaned ELB behind
cd terraform
terraform destroy
```

---

## Interview Talking Points (quick reference)

- **Jenkins stages**: each stage is an isolated, sequential unit of work;
  failure in any stage (e.g. failed tests, failed quality gate, Trivy
  HIGH/CRITICAL findings) halts the pipeline before a bad image reaches
  production — this is "shift-left" quality/security enforcement.
- **SonarQube Quality Gate**: a set of conditions (code coverage, duplicated
  lines, code smells, vulnerabilities) a build must pass; enforced
  asynchronously via a webhook back to Jenkins so the pipeline doesn't have to
  poll.
- **Trivy scanning**: scans the built image's OS packages and app
  dependencies against CVE databases; here it's split into a non-blocking
  LOW/MEDIUM report and a blocking HIGH/CRITICAL gate, balancing visibility vs
  build velocity.
- **Docker image lifecycle**: multi-stage build (compile React in a `node`
  stage, discard it, serve static output from a slim `nginx` stage) keeps the
  final image small and reduces attack surface; images are tagged both with
  the Jenkins build number (traceability/rollback) and `latest`.
- **Terraform provisioning**: declarative, versioned infrastructure —
  VPC/subnets/NAT/IGW for networking, IAM roles for the control plane and
  nodes, and the EKS cluster + managed node group itself; state can be stored
  remotely (S3 + DynamoDB lock) for team use.
- **EKS deployment**: Jenkins authenticates via IAM (mapped into the cluster's
  access entries/aws-auth), runs `aws eks update-kubeconfig` to get cluster
  credentials, then applies manifests with `kubectl apply`.
- **Kubernetes rollout verification**: `kubectl rollout status` blocks until
  the new ReplicaSet is fully available (respecting `maxUnavailable`/
  `maxSurge`), giving you a hard signal of deploy success or failure before
  the pipeline reports green.

---

## Before you push this to a real repo

- Replace `yourdockerhubuser/react-cicd-app` in the `Jenkinsfile`.
- Replace `arn:aws:iam::<account-id>:...` placeholders in this README with
  your real account ID when running those commands.
- Add a `.env`/secrets strategy if your React app needs runtime config (this
  scaffold assumes a static build with no server-side secrets baked in).
- Consider adding remote Terraform state (commented block in `providers.tf`)
  before multiple people run `terraform apply`.
