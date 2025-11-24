import { useState, useRef, useEffect } from "react";
import { 
  X, 
  MessageCircle, 
  Search, 
  ChevronRight,
  Home,
  Package,
  FileText,
  ShoppingCart,
  Truck,
  Users,
  DollarSign,
  Building2,
  Settings,
  Bell,
  HelpCircle,
  FolderTree,
  BarChart3,
  Trophy
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

interface HelpQuestion {
  id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  icon?: any;
  roles?: string[]; // Roles that can see this question (empty = all roles)
}

const helpData: HelpQuestion[] = [
  // === LOGIN & GETTING STARTED ===
  {
    id: "login-1",
    question: "How do I sign in to ProcuraHub?",
    answer: "Go to the login page, enter your email and password provided by your administrator, then click 'Sign In'. If you're a supplier, use the credentials you received via email after registration.",
    category: "Getting Started",
    keywords: ["login", "sign in", "access", "credentials", "password"],
    icon: Home,
    roles: [], // Available to all roles
  },
  {
    id: "login-2",
    question: "I forgot my password, what should I do?",
    answer: "Contact your system administrator or the procurement team to reset your password. For suppliers, reach out via the contact information in your registration confirmation email.",
    category: "Getting Started",
    keywords: ["forgot password", "reset", "locked out"],
    icon: HelpCircle,
    roles: [], // Available to all roles
  },

  // === PURCHASE REQUESTS (Requester) ===
  {
    id: "req-1",
    question: "How do I create a new purchase request?",
    answer: "Click the 'Create New Request' button on your dashboard. Fill in the title, description, category, department, justification, and deadline. You can also attach supporting documents. Click 'Submit Request' when ready.",
    category: "Purchase Requests",
    keywords: ["create request", "new request", "submit", "purchase request"],
    icon: FileText,
    roles: ["Requester"],
  },
  {
    id: "req-2",
    question: "What documents can I attach to my request?",
    answer: "You can attach any supporting documents like specifications, quotes, or approvals. Supported formats include PDF, Word documents, images, and Excel files. Just click 'Attach Files' and select your documents.",
    category: "Purchase Requests",
    keywords: ["attach", "documents", "upload", "files", "specifications"],
    icon: FileText,
    roles: ["Requester"],
  },
  {
    id: "req-3",
    question: "How do I check the status of my request?",
    answer: "On your Requester Dashboard, you'll see all your requests listed with their current status badges. Statuses include: Pending Procurement, Pending Finance, Finance Approved, RFQ Issued, Rejected, or Completed.",
    category: "Purchase Requests",
    keywords: ["status", "track", "check request", "pending", "approved"],
    icon: Bell,
    roles: ["Requester"],
  },
  {
    id: "req-4",
    question: "Can I add more documents to my request after submitting?",
    answer: "Yes! Open your request details by clicking on it, then use the 'Upload Additional Documents' section at the bottom to add more files even after submission.",
    category: "Purchase Requests",
    keywords: ["additional documents", "upload later", "add files"],
    icon: FileText,
    roles: ["Requester"],
  },
  {
    id: "req-5",
    question: "What does 'RFQ Issued' status mean?",
    answer: "'RFQ Issued' means your request has been approved and Procurement has created an RFQ (Request for Quotation) for it. Suppliers have been invited to submit quotes, and you can view the RFQ details from your request.",
    category: "Purchase Requests",
    keywords: ["rfq issued", "status", "approved", "quotation"],
    icon: ShoppingCart,
    roles: ["Requester"],
  },

  // === RFQs (Procurement & Procurement Officer) ===
  {
    id: "rfq-1",
    question: "How do I create an RFQ?",
    answer: "From your dashboard, click 'Create New RFQ'. Fill in the title, description, category, budget, currency, and deadline. Select suppliers from the list (system shows matching category suppliers first), attach any documents, and click 'Create RFQ'.",
    category: "RFQs",
    keywords: ["create rfq", "new rfq", "request for quotation"],
    icon: ShoppingCart,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "rfq-2",
    question: "How do I select suppliers for an RFQ?",
    answer: "When creating an RFQ, you'll see a supplier selection list. Suppliers matching your selected category appear under 'MATCHING CATEGORY', while others appear under 'OTHER CATEGORIES'. Select at least one supplier by checking their boxes.",
    category: "RFQs",
    keywords: ["select suppliers", "invite", "choose suppliers"],
    icon: Users,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "rfq-3",
    question: "Can I approve a draft RFQ created by a Procurement Officer?",
    answer: "Yes! As a Procurement user, you'll see draft RFQs in the 'Draft RFQs' section. Click on a draft, review the details, select suppliers if none were chosen, and click 'Approve & Send' to issue the RFQ.",
    category: "RFQs",
    keywords: ["approve draft", "draft rfq", "procurement officer"],
    icon: ShoppingCart,
    roles: ["Procurement"],
  },
  {
    id: "rfq-4",
    question: "Where can I see all active RFQs?",
    answer: "Click on the 'RFQs' tab in your dashboard. You'll see all RFQs categorized as: Draft RFQs, Active RFQs, Pending Finance Approval, and Awarded RFQs. Use the search bar to find specific RFQs quickly.",
    category: "RFQs",
    keywords: ["view rfqs", "active rfqs", "find rfq", "rfq list"],
    icon: ShoppingCart,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "rfq-5",
    question: "How do I view quotations submitted for an RFQ?",
    answer: "Click on an RFQ from your list to open its details. Scroll down to the 'Quotations' section to see all submitted quotes from suppliers, including amounts, status, and submission dates.",
    category: "RFQs",
    keywords: ["quotations", "bids", "submitted quotes", "supplier responses"],
    icon: FileText,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "rfq-6",
    question: "How do I award an RFQ to a supplier?",
    answer: "Open the RFQ details, review the quotations in the 'Quotations' section, and click 'Approve' on the winning quotation. If it exceeds budget, you'll need to request Finance approval first.",
    category: "RFQs",
    keywords: ["award", "approve quotation", "select winner", "approve bid"],
    icon: ShoppingCart,
    roles: ["Procurement"],
  },
  {
    id: "rfq-7",
    question: "What happens when a quotation exceeds the budget?",
    answer: "When you try to approve a quotation that exceeds the RFQ budget, the system will automatically send it to Finance for approval. You'll need to provide a justification explaining why this quotation should be accepted despite exceeding budget.",
    category: "RFQs",
    keywords: ["over budget", "exceed budget", "finance approval", "justification"],
    icon: DollarSign,
    roles: ["Procurement"],
  },
  {
    id: "rfq-8",
    question: "How do I download RFQ documents?",
    answer: "Open the RFQ details and scroll to the 'Attached Documents' section. Click the download button next to any document to save it to your computer.",
    category: "RFQs",
    keywords: ["download", "documents", "attachments", "rfq files"],
    icon: FileText,
    roles: ["Procurement", "ProcurementOfficer", "Supplier"],
  },

  // === SUPPLIERS (Procurement & Admin) ===
  {
    id: "sup-1",
    question: "How do I register a new supplier?",
    answer: "Go to the 'Suppliers' tab and click 'Create New Supplier'. Fill in company details including name, email, contact person, phone, address, and preferred currency. Upload required documents (incorporation, tax clearance, company profile), then submit.",
    category: "Suppliers",
    keywords: ["register supplier", "new supplier", "add supplier", "create supplier"],
    icon: Users,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "sup-2",
    question: "What documents do suppliers need to upload?",
    answer: "Suppliers must upload: Certificate of Incorporation, Tax Clearance Certificate, and Company Profile. These documents verify the supplier's legitimacy and compliance.",
    category: "Suppliers",
    keywords: ["supplier documents", "required documents", "incorporation", "tax clearance"],
    icon: FileText,
    roles: ["Procurement", "ProcurementOfficer", "Supplier"],
  },
  {
    id: "sup-3",
    question: "How do I view supplier details?",
    answer: "From the Suppliers tab, click on any supplier name to open their detailed profile. You'll see company information, contact details, categories, awarded value, registration documents, and performance history.",
    category: "Suppliers",
    keywords: ["supplier profile", "view supplier", "supplier details", "company info"],
    icon: Building2,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "sup-4",
    question: "Can I message a supplier directly?",
    answer: "Yes! Open the supplier's profile and click 'Send Message'. Type your message and click 'Send'. The supplier will receive an email notification and can view the message in their dashboard.",
    category: "Suppliers",
    keywords: ["message supplier", "contact", "communicate", "send message"],
    icon: MessageCircle,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "sup-5",
    question: "How do I download supplier documents?",
    answer: "In the supplier profile, scroll to the 'Documents' section. Click the download icon next to any document (Incorporation Certificate, Tax Clearance, or Company Profile) to save it.",
    category: "Suppliers",
    keywords: ["download supplier documents", "incorporation", "certificates"],
    icon: FileText,
    roles: ["Procurement", "ProcurementOfficer"],
  },

  // === SUPPLIER DASHBOARD ===
  {
    id: "supdash-1",
    question: "How do I view RFQs I've been invited to?",
    answer: "When you log in as a supplier, you'll see the 'Invitations' section showing all RFQs you've been invited to respond to. Click on any invitation to view details and submit your quotation.",
    category: "Supplier Dashboard",
    keywords: ["invitations", "invited rfqs", "supplier invitations", "respond"],
    icon: Bell,
    roles: ["Supplier"],
  },
  {
    id: "supdash-2",
    question: "How do I submit a quotation?",
    answer: "Click on an RFQ invitation, then click 'Respond Now'. Enter your quotation amount, select currency, choose tax type (VAT/TOT/None), add optional notes, and attach your quotation document. Click 'Submit Quotation'.",
    category: "Supplier Dashboard",
    keywords: ["submit quotation", "bid", "quote", "respond to rfq", "proposal"],
    icon: FileText,
    roles: ["Supplier"],
  },
  {
    id: "supdash-3",
    question: "Can I submit a quotation with tax included?",
    answer: "Yes! When submitting a quotation, select the tax type: VAT (16%), TOT (5%), or None. The system will automatically calculate the tax amount based on your selection.",
    category: "Supplier Dashboard",
    keywords: ["vat", "tot", "tax", "quotation tax", "pricing"],
    icon: DollarSign,
    roles: ["Supplier"],
  },
  {
    id: "supdash-4",
    question: "How do I know if my quotation was accepted?",
    answer: "Check your 'Purchase Orders' section in your dashboard. If your quotation was accepted, it will appear there with 'Approved' status. You'll also receive an email notification when your quotation is approved or rejected.",
    category: "Supplier Dashboard",
    keywords: ["approved", "accepted", "quotation status", "won bid", "selected"],
    icon: Package,
    roles: ["Supplier"],
  },
  {
    id: "supdash-5",
    question: "How do I download my Purchase Order?",
    answer: "In your Purchase Orders section, find the approved quotation and click 'Download PO' or 'View Purchase Order'. The system will generate a PDF with all contract details including terms and conditions.",
    category: "Supplier Dashboard",
    keywords: ["purchase order", "po", "download po", "contract"],
    icon: FileText,
    roles: ["Supplier"],
  },
  {
    id: "supdash-6",
    question: "Where can I see all active RFQs I can bid on?",
    answer: "The 'Active RFQs' section shows all open RFQs you've been invited to that haven't closed yet. These are RFQs where you can still submit or update your quotation before the deadline.",
    category: "Supplier Dashboard",
    keywords: ["active rfqs", "open bids", "available rfqs", "submit quote"],
    icon: ShoppingCart,
    roles: ["Supplier"],
  },

  // === FINANCE DASHBOARD ===
  {
    id: "fin-1",
    question: "How do I approve purchase requests?",
    answer: "From your Finance Dashboard, click on a purchase request that shows 'Pending Finance' status. Review the details, enter the approved budget amount, add optional finance notes, and click 'Approve'.",
    category: "Finance",
    keywords: ["approve request", "finance approval", "budget", "approve purchase"],
    icon: DollarSign,
    roles: ["Finance"],
  },
  {
    id: "fin-2",
    question: "How do I handle quotations that exceed budget?",
    answer: "Quotations exceeding budget appear in the 'Quotations Pending Approval' section (amber/orange card). Click on an RFQ, review the quotation details and justification provided by Procurement, then approve or reject it.",
    category: "Finance",
    keywords: ["over budget", "exceed budget", "quotation approval", "budget override"],
    icon: DollarSign,
    roles: ["Finance"],
  },
  {
    id: "fin-3",
    question: "Can I reject a purchase request?",
    answer: "Yes. When reviewing a purchase request, instead of clicking 'Approve', click 'Reject'. You'll need to provide a rejection reason explaining why the request cannot be approved.",
    category: "Finance",
    keywords: ["reject request", "deny", "decline", "rejection reason"],
    icon: X,
    roles: ["Finance"],
  },
  {
    id: "fin-4",
    question: "Where can I see approved RFQs I've processed?",
    answer: "The 'Finance Approved RFQs' section (green card) shows all RFQs where you approved quotations that exceeded budget. This serves as your approval history and audit trail.",
    category: "Finance",
    keywords: ["approved rfqs", "approval history", "finance records", "audit trail"],
    icon: FileText,
    roles: ["Finance"],
  },
  {
    id: "fin-5",
    question: "How do I view the budget overview?",
    answer: "Your Finance Dashboard displays key statistics at the top showing: Total Requests, Pending Approvals, Approved Requests, and Rejected Requests. This gives you a quick overview of your workload.",
    category: "Finance",
    keywords: ["budget overview", "statistics", "dashboard stats", "pending approvals"],
    icon: DollarSign,
    roles: ["Finance"],
  },

  // === PURCHASE ORDERS ===
  {
    id: "po-1",
    question: "Where can I find all Purchase Orders?",
    answer: "From the Procurement dashboard, click on the 'Purchase Orders' tab. You'll see a table listing all approved quotations with PO numbers, supplier names, amounts, and approval dates.",
    category: "Purchase Orders",
    keywords: ["purchase orders", "po list", "approved quotations", "contracts"],
    icon: Package,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "po-2",
    question: "How do I view a specific Purchase Order?",
    answer: "In the Purchase Orders tab, find the PO you want to view and click 'View RFQ' to see the complete details including all quotations, documents, and contract information.",
    category: "Purchase Orders",
    keywords: ["view po", "purchase order details", "contract details"],
    icon: Package,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "po-3",
    question: "What information is included in a Purchase Order?",
    answer: "Each PO includes: PO number, supplier details, awarded amount, currency, RFQ reference, approval date, submission date, company terms and conditions, and delivery requirements.",
    category: "Purchase Orders",
    keywords: ["po information", "contract details", "purchase order content"],
    icon: FileText,
    roles: ["Procurement", "ProcurementOfficer", "Supplier"],
  },

  // === DELIVERY NOTES ===
  {
    id: "del-1",
    question: "How do I mark a contract as delivered?",
    answer: "Go to the 'Delivery Notes' tab, find the approved quotation, click 'Mark as Delivered'. Enter the delivery date, upload the delivery note document (proof of delivery), and submit.",
    category: "Delivery Notes",
    keywords: ["mark delivered", "delivery", "delivery note", "completion", "fulfilled"],
    icon: Truck,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "del-2",
    question: "What is a delivery note?",
    answer: "A delivery note is a document that confirms goods or services have been delivered. It serves as proof of delivery and should be uploaded when marking a contract as fulfilled in the system.",
    category: "Delivery Notes",
    keywords: ["delivery note", "proof of delivery", "delivery document", "pod"],
    icon: Truck,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "del-3",
    question: "Can I download delivery notes?",
    answer: "Yes! In the Delivery Notes tab, you'll see all delivered contracts with a 'Download' button next to each. Click it to download the delivery note document that was uploaded.",
    category: "Delivery Notes",
    keywords: ["download delivery note", "delivery document", "proof of delivery"],
    icon: FileText,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "del-4",
    question: "How do I track which orders have been delivered?",
    answer: "The 'Delivery Notes' tab shows all approved quotations. Those marked as 'Delivered' will have a green badge, delivery date, and the person who confirmed delivery. Undelivered orders show 'Pending Delivery'.",
    category: "Delivery Notes",
    keywords: ["track delivery", "delivery status", "fulfilled orders", "pending delivery"],
    icon: Truck,
    roles: ["Procurement", "ProcurementOfficer"],
  },

  // === CATEGORIES (Admin) ===
  {
    id: "cat-1",
    question: "How do I create a new category?",
    answer: "From the SuperAdmin or Procurement dashboard, go to the 'Categories' tab and click 'Create New Category'. Enter the category name and description, then click 'Create Category'.",
    category: "Categories",
    keywords: ["create category", "new category", "add category"],
    icon: FolderTree,
    roles: ["SuperAdmin", "Procurement"],
  },
  {
    id: "cat-2",
    question: "Can I edit existing categories?",
    answer: "Yes! In the Categories tab, find the category you want to edit and click the 'Edit' button. Update the name or description, then save your changes.",
    category: "Categories",
    keywords: ["edit category", "update category", "modify category"],
    icon: FolderTree,
    roles: ["SuperAdmin", "Procurement"],
  },
  {
    id: "cat-3",
    question: "How do I delete a category?",
    answer: "In the Categories tab, click the 'Delete' button next to the category you want to remove. Confirm the deletion when prompted. Note: You cannot delete categories that are in use by suppliers or RFQs.",
    category: "Categories",
    keywords: ["delete category", "remove category"],
    icon: FolderTree,
    roles: ["SuperAdmin", "Procurement"],
  },
  {
    id: "cat-4",
    question: "What are category details?",
    answer: "Click 'View Details' on any category to see: category name, description, number of suppliers registered in that category, and number of RFQs created for that category.",
    category: "Categories",
    keywords: ["category details", "view category", "category info"],
    icon: FolderTree,
    roles: ["SuperAdmin", "Procurement"],
  },

  // === USERS (SuperAdmin) ===
  {
    id: "user-1",
    question: "How do I create a new user account?",
    answer: "As SuperAdmin, go to the 'Users' tab and click 'Create User'. Fill in email, full name, password, select role (Procurement/Finance/Requester/Procurement Officer), choose timezone, and submit.",
    category: "Users",
    keywords: ["create user", "new user", "add user", "user account"],
    icon: Users,
    roles: ["SuperAdmin"],
  },
  {
    id: "user-2",
    question: "What are the different user roles?",
    answer: "ProcuraHub has 6 roles: SuperAdmin (full access), Procurement (create RFQs, manage suppliers), Procurement Officer (create draft RFQs), Finance (approve budgets), Requester (create purchase requests), and Supplier (submit quotations).",
    category: "Users",
    keywords: ["user roles", "roles", "permissions", "access levels"],
    icon: Users,
    roles: ["SuperAdmin"],
  },
  {
    id: "user-3",
    question: "How do I delete a user?",
    answer: "In the Users tab, find the user and click the 'Delete' button. Confirm the deletion when prompted. This action is permanent and cannot be undone.",
    category: "Users",
    keywords: ["delete user", "remove user", "deactivate"],
    icon: Users,
    roles: ["SuperAdmin"],
  },
  {
    id: "user-4",
    question: "Can I change a user's role?",
    answer: "Currently, to change a user's role, you need to delete the old account and create a new one with the desired role. Make sure to communicate the new credentials to the user.",
    category: "Users",
    keywords: ["change role", "update role", "modify user"],
    icon: Users,
    roles: ["SuperAdmin"],
  },

  // === REPORTS & ANALYTICS ===
  {
    id: "rep-1",
    question: "Where can I see system statistics?",
    answer: "SuperAdmin users can access the 'Reports' tab to view comprehensive analytics including: total users, active suppliers, RFQs by status, total quotations, and top performing suppliers.",
    category: "Reports",
    keywords: ["statistics", "analytics", "reports", "dashboard stats"],
    icon: BarChart3,
    roles: ["SuperAdmin"],
  },
  {
    id: "rep-2",
    question: "How do I view supplier performance?",
    answer: "In the Reports tab, scroll to the 'Top Suppliers' section to see suppliers ranked by total awarded value. You can also view individual supplier profiles to see their performance history.",
    category: "Reports",
    keywords: ["supplier performance", "top suppliers", "awarded value", "rankings"],
    icon: Trophy,
    roles: ["SuperAdmin"],
  },

  // === SETTINGS ===
  {
    id: "set-1",
    question: "How do I update company settings?",
    answer: "As SuperAdmin, click 'Company Settings' button. You can update: company name, address, phone, email, website, logo, purchase order terms and conditions, and other company details.",
    category: "Settings",
    keywords: ["company settings", "update company", "logo", "terms"],
    icon: Settings,
    roles: ["SuperAdmin"],
  },
  {
    id: "set-2",
    question: "Can I customize Purchase Order terms and conditions?",
    answer: "Yes! In Company Settings, scroll to the 'Purchase Order Terms & Conditions' section. Edit the text to match your company's requirements. These terms will appear on all generated Purchase Orders.",
    category: "Settings",
    keywords: ["terms and conditions", "po terms", "customize", "contract terms"],
    icon: Settings,
    roles: ["SuperAdmin"],
  },
  {
    id: "set-3",
    question: "How do I upload a company logo?",
    answer: "In Company Settings, find the 'Company Logo' section. Click 'Choose File', select your logo image (PNG or JPG), and upload it. The logo will appear on Purchase Orders and official documents.",
    category: "Settings",
    keywords: ["company logo", "upload logo", "branding"],
    icon: Settings,
    roles: ["SuperAdmin"],
  },

  // === SEARCH & NAVIGATION ===
  {
    id: "nav-1",
    question: "How do I search for something?",
    answer: "Use the search bar at the top of your dashboard. Select what you want to search (RFQs, Suppliers, Requests, etc.) from the dropdown, then type your search term. Results appear instantly as you type.",
    category: "Navigation",
    keywords: ["search", "find", "filter", "lookup"],
    icon: Search,
    roles: ["Procurement", "ProcurementOfficer"],
  },
  {
    id: "nav-2",
    question: "How do I switch between different sections?",
    answer: "Use the tab navigation at the top of your dashboard. Click on tabs like 'RFQs', 'Suppliers', 'Categories', 'Purchase Orders', or 'Delivery Notes' to switch between different sections.",
    category: "Navigation",
    keywords: ["navigation", "tabs", "switch sections", "menu"],
    icon: Home,
    roles: [],
  },
  {
    id: "nav-3",
    question: "How do I log out?",
    answer: "Click on your profile icon or name in the top right corner of the page, then select 'Logout' from the dropdown menu.",
    category: "Navigation",
    keywords: ["logout", "sign out", "exit"],
    icon: Home,
    roles: [],
  },

  // === NOTIFICATIONS ===
  {
    id: "not-1",
    question: "Will I receive email notifications?",
    answer: "Yes! You'll receive emails when: you're invited to an RFQ (suppliers), quotations are submitted, quotations are approved/rejected, RFQs are created from your request, and other important updates.",
    category: "Notifications",
    keywords: ["notifications", "emails", "alerts", "updates"],
    icon: Bell,
    roles: [],
  },
  {
    id: "not-2",
    question: "How do I know when there are new updates?",
    answer: "The dashboard tabs show notification badges (red numbers) when there are new items. For example, the RFQs tab will show a badge when new RFQs are created or quotations are submitted.",
    category: "Notifications",
    keywords: ["updates", "notifications", "new items", "badges"],
    icon: Bell,
    roles: [],
  },
];

const HelpChatbot: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<HelpQuestion | null>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  // Filter help data based on user role
  const userRole = user?.role || "";
  const roleFilteredData = helpData.filter(q => {
    // If no roles specified or roles array is empty, show to all users
    if (!q.roles || q.roles.length === 0) {
      return true;
    }
    // Check if user's role matches any of the allowed roles
    return q.roles.some(role => role.toLowerCase() === userRole.toLowerCase());
  });

  // Extract unique categories from filtered data
  const categories = Array.from(new Set(roleFilteredData.map(q => q.category)));

  // Filter questions based on search and category
  const filteredQuestions = roleFilteredData.filter(q => {
    const matchesSearch = searchQuery === "" || 
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = !selectedCategory || q.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Get suggested questions (top 6 from different categories)
  const suggestedQuestions = roleFilteredData.filter((q, idx, arr) => {
    const categoryFirstIndex = arr.findIndex(item => item.category === q.category);
    return idx === categoryFirstIndex || (idx < 6 && categoryFirstIndex < 6);
  }).slice(0, 6);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = 0;
    }
  }, [selectedQuestion, selectedCategory]);

  const handleQuestionClick = (question: HelpQuestion) => {
    setSelectedQuestion(question);
    setSearchQuery("");
  };

  const handleBack = () => {
    setSelectedQuestion(null);
    setSelectedCategory(null);
  };

  const getCategoryIcon = (category: string) => {
    const iconMap: Record<string, any> = {
      "Getting Started": Home,
      "Purchase Requests": FileText,
      "RFQs": ShoppingCart,
      "Suppliers": Users,
      "Supplier Dashboard": Building2,
      "Finance": DollarSign,
      "Purchase Orders": Package,
      "Delivery Notes": Truck,
      "Categories": FolderTree,
      "Users": Users,
      "Reports": BarChart3,
      "Settings": Settings,
      "Navigation": Search,
      "Notifications": Bell,
    };
    return iconMap[category] || HelpCircle;
  };

  return (
    <>
      {/* Floating Chat Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-secondary via-secondary to-primary shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-[0_20px_60px_-15px_rgba(16,125,172,0.6)]"
          aria-label="Open Help"
        >
          <div className="relative">
            <MessageCircle className="h-7 w-7 text-white" strokeWidth={2.5} />
            <div className="absolute -right-1 -top-1 h-3 w-3 animate-ping rounded-full bg-white opacity-75"></div>
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white"></div>
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[600px] w-[420px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-primary via-slate-900 to-secondary px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <HelpCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Nestro AI</h3>
                <p className="text-xs text-white/80">Your ProcuraHub Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-white/80 transition hover:bg-white/20 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search for help..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedQuestion(null);
                  setSelectedCategory(null);
                }}
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 placeholder-slate-400 transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20"
              />
            </div>
          </div>

          {/* Chat Body */}
          <div ref={chatBodyRef} className="flex-1 overflow-y-auto px-4 py-4">
            {/* Show selected question answer */}
            {selectedQuestion ? (
              <div className="space-y-4">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm font-medium text-secondary transition hover:text-primary"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Back to questions
                </button>
                <div className="rounded-xl bg-gradient-to-br from-secondary/5 to-primary/5 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    {selectedQuestion.icon && (
                      <div className="rounded-lg bg-secondary/10 p-2">
                        <selectedQuestion.icon className="h-5 w-5 text-secondary" />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-700">{selectedQuestion.question}</p>
                      <span className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
                        {selectedQuestion.category}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white p-4 shadow-sm">
                    <p className="text-sm leading-relaxed text-slate-700">{selectedQuestion.answer}</p>
                  </div>
                </div>
              </div>
            ) : selectedCategory ? (
              /* Show questions in selected category */
              <div className="space-y-3">
                <button
                  onClick={handleBack}
                  className="flex items-center gap-2 text-sm font-medium text-secondary transition hover:text-primary"
                >
                  <ChevronRight className="h-4 w-4 rotate-180" />
                  Back to categories
                </button>
                <h4 className="text-sm font-semibold text-slate-700">{selectedCategory}</h4>
                {filteredQuestions.filter(q => q.category === selectedCategory).map((question) => {
                  const Icon = question.icon || HelpCircle;
                  return (
                    <button
                      key={question.id}
                      onClick={() => handleQuestionClick(question)}
                      className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-secondary hover:shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-slate-100 p-2 transition group-hover:bg-secondary/10">
                          <Icon className="h-4 w-4 text-slate-600 transition group-hover:text-secondary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-700 group-hover:text-secondary">{question.question}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-secondary" />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : searchQuery ? (
              /* Show search results */
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  {filteredQuestions.length} result{filteredQuestions.length !== 1 ? 's' : ''} for "{searchQuery}"
                </p>
                {filteredQuestions.length === 0 ? (
                  <div className="py-12 text-center">
                    <Search className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-4 text-sm text-slate-500">No results found</p>
                    <p className="mt-1 text-xs text-slate-400">Try different keywords</p>
                  </div>
                ) : (
                  filteredQuestions.map((question) => {
                    const Icon = question.icon || HelpCircle;
                    return (
                      <button
                        key={question.id}
                        onClick={() => handleQuestionClick(question)}
                        className="group w-full rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-secondary hover:shadow-md"
                      >
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-slate-100 p-2 transition group-hover:bg-secondary/10">
                            <Icon className="h-4 w-4 text-slate-600 transition group-hover:text-secondary" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700 group-hover:text-secondary">{question.question}</p>
                            <span className="mt-1 inline-block text-xs text-slate-500">{question.category}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-secondary" />
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              /* Show default view with categories and suggestions */
              <div className="space-y-6">
                {/* Welcome message */}
                <div className="rounded-xl bg-gradient-to-br from-secondary/10 to-primary/10 p-4">
                  <p className="text-sm font-medium text-slate-700">Hi there! 👋</p>
                  <p className="mt-1 text-xs text-slate-600">
                    I'm Nestro, your ProcuraHub assistant. How can I help you navigate the platform today?
                  </p>
                </div>

                {/* Categories */}
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Browse by Topic</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {categories.slice(0, 8).map((category) => {
                      const Icon = getCategoryIcon(category);
                      const count = roleFilteredData.filter(q => q.category === category).length;
                      return (
                        <button
                          key={category}
                          onClick={() => setSelectedCategory(category)}
                          className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-secondary hover:shadow-md"
                        >
                          <div className="rounded-lg bg-slate-100 p-2 transition group-hover:bg-secondary/10">
                            <Icon className="h-5 w-5 text-slate-600 transition group-hover:text-secondary" />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-slate-700 group-hover:text-secondary">{category}</p>
                            <p className="text-xs text-slate-500">{count} tip{count !== 1 ? 's' : ''}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Popular questions */}
                <div>
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Popular Questions</h4>
                  <div className="space-y-2">
                    {suggestedQuestions.map((question) => {
                      const Icon = question.icon || HelpCircle;
                      return (
                        <button
                          key={question.id}
                          onClick={() => handleQuestionClick(question)}
                          className="group w-full rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-secondary hover:shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-4 w-4 flex-shrink-0 text-slate-400 transition group-hover:text-secondary" />
                            <p className="flex-1 text-xs font-medium text-slate-700 group-hover:text-secondary">{question.question}</p>
                            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition group-hover:text-secondary" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-center text-xs text-slate-500">
              Can't find what you're looking for? Contact support.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpChatbot;
