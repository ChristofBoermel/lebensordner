# Lebensordner AI Context - Hetzner Migration & Serverless Implementation

## Project Overview
Lebensordner is a German digital life management application that helps users organize personal documents, medical records, and family information. The application has been migrated from Vercel to a self-hosted Hetzner server for better control and cost optimization.

## Recent Migration Status (Feb 2026)
✅ **COMPLETED**: Full migration from Vercel to Hetzner CPX32 server
- Server: Hetzner CPX32 (46.224.182.244)
- Infrastructure: Docker Compose with full monitoring stack
- Database: Supabase PostgreSQL with imported production data
- SSL: Let's Encrypt certificates for all domains
- All services healthy and operational

## Current Architecture

### Production Server Setup
- **Server**: Hetzner CPX32 (8 vCPU, 32GB RAM)
- **Location**: Falkenstein, Germany
- **OS**: Ubuntu with Docker
- **Domains**: lebensordner.org, studio.lebensordner.org, grafana.lebensordner.org

### Core Services
- **Frontend**: Next.js 16 application (lebensordner-app)
- **Database**: Supabase PostgreSQL (supabase-db)
- **Auth**: Supabase Auth (supabase-auth)
- **API**: Supabase REST API (supabase-rest)
- **Storage**: Supabase Storage (supabase-storage)
- **Gateway**: Kong API Gateway (supabase-kong)
- **Reverse Proxy**: Caddy with SSL termination
- **Monitoring**: Prometheus, Grafana, Loki, Promtail

### Key Features
- Document management with encryption
- Medical record tracking (BMP scans)
- Family member management
- GDPR compliance with consent management
- Email notifications and invitations
- Subscription tiers with Stripe integration

## Current Development Focus

### Serverless Implementation Goals
The next phase involves implementing serverless patterns while maintaining the self-hosted infrastructure:

1. **Queue System**: BullMQ for background job processing
2. **Scheduled Tasks**: Replace Vercel cron with BullMQ delayed jobs
3. **Email Processing**: Queue-based email sending
4. **Document Processing**: Async document encryption/decryption
5. **Rate Limiting**: Redis-based rate limiting (already implemented)

### Infrastructure Improvements
1. **Auto-scaling**: Implement container auto-scaling based on load
2. **Load Balancing**: Multiple app instances behind load balancer
3. **Database Optimization**: Connection pooling and query optimization
4. **Monitoring Enhancement**: Custom dashboards and alerting
5. **Backup Automation**: Automated database and file backups

### Development Priorities
1. **Performance Optimization**: Database queries, image optimization, caching
2. **Security Enhancements**: Advanced authentication, audit logging
3. **Feature Development**: New document types, improved UI/UX
4. **Testing**: Comprehensive test suite expansion
5. **Documentation**: API documentation and user guides

## Technical Stack Details

### Frontend
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks and context
- **Authentication**: Supabase Auth with custom providers
- **Forms**: React Hook Form with Zod validation

### Backend
- **Database**: PostgreSQL 15 with Supabase extensions
- **API**: RESTful API via PostgREST
- **Real-time**: Supabase Realtime subscriptions
- **File Storage**: Supabase Storage with encryption
- **Background Jobs**: BullMQ with Redis
- **Email**: Resend with templates

### Infrastructure
- **Containerization**: Docker and Docker Compose
- **Reverse Proxy**: Caddy with automatic SSL
- **Monitoring**: Prometheus + Grafana + Loki
- **Logging**: Structured logging with Loki
- **CI/CD**: GitHub Actions (to be implemented)

## Deployment Strategy
- **Environment**: Production on Hetzner, staging via Docker
- **Database Migrations**: Supabase migrations with versioning
- **Rollback Strategy**: Database backups and container rollbacks
- **Monitoring**: Real-time alerts for service health

## Business Context
- **Target Market**: German-speaking users (Germany, Austria, Switzerland)
- **Compliance**: GDPR compliant with German data protection laws
- **Monetization**: Subscription-based model with Stripe
- **User Base**: Growing user base with focus on privacy and security

## Common Tasks for AI Assistant
1. **Code Review**: Review new features for security and performance
2. **Database Schema**: Design and optimize database schemas
3. **API Development**: Create and optimize API endpoints
4. **Frontend Components**: Build reusable React components
5. **Infrastructure**: Docker optimization and monitoring setup
6. **Testing**: Write unit and integration tests
7. **Documentation**: Update technical documentation
8. **Performance**: Optimize queries and frontend performance
9. **Security**: Implement security best practices
10. **Deployment**: Assist with deployment and monitoring

## Important Notes
- Always maintain GDPR compliance
- Prioritize security and data privacy
- Focus on German market requirements
- Maintain code quality and testing standards
- Consider scalability in all implementations
